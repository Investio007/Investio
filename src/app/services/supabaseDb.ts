import type { User } from "@supabase/supabase-js";
import type { InvestioAsset } from "../data/assets";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

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
  portfolio: InvestioAsset[];
  portfolioConfig: PortfolioConfig;
};

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
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

  const portfolio = (items ?? [])
    .map((row) => row.asset_data as InvestioAsset)
    .filter(Boolean);

  return {
    demoBalance: Number(profile?.demo_balance ?? 25000),
    portfolio,
    portfolioConfig: (profile?.portfolio_config as PortfolioConfig) ?? null,
  };
}

export async function saveUserAppData(
  user: User,
  data: UserAppData,
): Promise<void> {
  const client = requireClient();

  const { error: profileError } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email,
    demo_balance: data.demoBalance,
    portfolio_config: data.portfolioConfig,
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

  if (data.portfolio.length === 0) {
    return;
  }

  const { error: insertError } = await client.from("portfolio_items").insert(
    data.portfolio.map((asset) => ({
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

export async function signOutUser() {
  const client = requireClient();
  return client.auth.signOut();
}
