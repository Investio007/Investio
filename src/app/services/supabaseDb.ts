import type { User } from "@supabase/supabase-js";
import type { CrowthAsset } from "../data/assets";
import type { PortfoliosStore } from "../types/portfolio";
import { migrateLegacyPortfolio } from "../types/portfolio";
import { getAuthRedirectUrl, getPasswordResetRedirectUrl, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getMarketApiBaseUrl } from "../lib/marketApiBaseUrl";
import { isCapacitorNative } from "../../lib/capacitorPlatform";
import { signInWithOAuthNative } from "../../lib/mobileOAuth";
import {
  getGoogleWebClientId,
  isNativeGoogleAuthAvailable,
  signInWithGoogleNative,
} from "../../lib/nativeGoogleAuth";
import { signInWithGoogleWeb } from "../../lib/webGoogleAuth";

export type PortfolioConfig = {
  amount: number;
  risk: string;
  goal: string;
  allocation: {
    growth: number;
    balanced: number;
    safe: number;
  };
} | null;

export type UserAppData = {
  demoBalance: number;
  portfoliosStore: PortfoliosStore;
};

function parsePortfoliosStore(raw: unknown, fallbackHoldings: CrowthAsset[]): PortfoliosStore {
  if (raw && typeof raw === "object" && "version" in raw && (raw as PortfoliosStore).version === 2) {
    const store = raw as PortfoliosStore;
    return {
      version: 2,
      activePortfolioId: store.activePortfolioId,
      portfolios: Array.isArray(store.portfolios) ? store.portfolios : [],
    };
  }

  const legacyConfig =
    raw && typeof raw === "object" && !("version" in raw)
      ? (raw as PortfolioConfig)
      : null;

  return migrateLegacyPortfolio(fallbackHoldings, legacyConfig);
}

function flattenHoldings(store: PortfoliosStore): CrowthAsset[] {
  return store.portfolios.flatMap((portfolio) =>
    portfolio.holdings.map((asset) => ({
      ...asset,
      _portfolioId: portfolio.id,
    })),
  );
}

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
    );
  }
  return supabase;
}

export async function loadUserAppData(user: User): Promise<UserAppData | null> {
  const client = requireClient();

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("demo_balance, portfolio_config")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[Crowth] profile load failed:", profileError.message);
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from("portfolio_items")
    .select("asset_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("[Crowth] portfolio load failed:", itemsError.message);
    return null;
  }

  const fallbackHoldings = (items ?? [])
    .map((row) => row.asset_data as CrowthAsset)
    .filter(Boolean);

  const portfoliosStore = parsePortfoliosStore(profile?.portfolio_config, fallbackHoldings);

  return {
    demoBalance: Number(profile?.demo_balance ?? 25000),
    portfoliosStore,
  };
}

export async function saveUserAppData(user: User, data: UserAppData): Promise<void> {
  const client = requireClient();

  const { error: profileError } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email,
    demo_balance: data.demoBalance,
    portfolio_config: data.portfoliosStore,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: deleteError } = await client
    .from("portfolio_items")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const flat = flattenHoldings(data.portfoliosStore);
  if (flat.length === 0) {
    return;
  }

  const { error: insertError } = await client.from("portfolio_items").insert(
    flat.map((asset) => ({
      user_id: user.id,
      asset_id: asset.id,
      asset_data: asset,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const client = requireClient();
  const emailRedirectTo = getAuthRedirectUrl();
  return client.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireClient();
  return client.auth.signInWithPassword({ email, password });
}

export type OAuthProvider = "google" | "apple";

export async function signInWithOAuth(provider: OAuthProvider) {
  const client = requireClient();
  const redirectTo = getAuthRedirectUrl();

  if (isCapacitorNative()) {
    if (provider === "google" && isNativeGoogleAuthAvailable()) {
      return signInWithGoogleNative(client);
    }
    return signInWithOAuthNative(client, provider);
  }

  // Web Google: GIS on the app origin so the chooser shows crowthza.app / localhost
  // instead of …supabase.co (no paid Supabase custom domain required).
  if (provider === "google" && getGoogleWebClientId()) {
    return signInWithGoogleWeb(client);
  }

  return client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
}

export async function signOutUser() {
  const client = requireClient();
  return client.auth.signOut();
}

export async function updateUserDisplayName(fullName: string) {
  const client = requireClient();
  return client.auth.updateUser({
    data: {
      full_name: fullName,
      name: fullName,
      display_name: fullName,
    },
  });
}

/** Permanently deletes the signed-in user (Auth + demo data). */
export async function deleteUserAccount(): Promise<{
  error: { message: string } | null;
}> {
  const client = requireClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    return { error: { message: "You must be signed in to delete your account." } };
  }

  // Preferred: Postgres security-definer RPC (no service role on the Worker).
  const { error: rpcError } = await client.rpc("delete_own_account");
  if (!rpcError) {
    return { error: null };
  }

  // Fallback: clear rows then Worker admin delete (needs SUPABASE_SERVICE_ROLE_KEY).
  const userId = session.user.id;
  await client.from("portfolio_items").delete().eq("user_id", userId);
  await client.from("profiles").delete().eq("id", userId);

  const base = getMarketApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) return { error: null };

    let message =
      rpcError.message ||
      "Could not delete account. Ask an admin to run supabase/delete_own_account.sql.";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      /* ignore */
    }
    return { error: { message } };
  } catch {
    return {
      error: {
        message:
          rpcError.message ||
          "Could not delete account. Run supabase/delete_own_account.sql in the SQL editor.",
      },
    };
  }
}

export async function requestPasswordReset(email: string) {
  const client = requireClient();
  const redirectTo = getPasswordResetRedirectUrl();
  return client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
}

export async function updatePassword(newPassword: string) {
  const client = requireClient();
  return client.auth.updateUser({ password: newPassword });
}
