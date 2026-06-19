import type { User } from "@supabase/supabase-js";
import type { InvestioAsset } from "../data/assets";
import type { PortfoliosStore } from "../types/portfolio";
import { migrateLegacyPortfolio } from "../types/portfolio";
import { getAuthRedirectUrl, getPasswordResetRedirectUrl, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { isCapacitorNative } from "../../lib/capacitorPlatform";
import { signInWithOAuthNative } from "../../lib/mobileOAuth";

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

function parsePortfoliosStore(raw: unknown, fallbackHoldings: InvestioAsset[]): PortfoliosStore {
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

function flattenHoldings(store: PortfoliosStore): InvestioAsset[] {
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
    console.error("[Investio] profile load failed:", profileError.message);
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from("portfolio_items")
    .select("asset_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("[Investio] portfolio load failed:", itemsError.message);
    return null;
  }

  const fallbackHoldings = (items ?? [])
    .map((row) => row.asset_data as InvestioAsset)
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
  return client.auth.signUp({ email, password });
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
    return signInWithOAuthNative(client, provider);
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
