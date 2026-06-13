import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { InvestioAsset } from "../data/assets";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import {
  loadUserAppData,
  saveUserAppData,
  type PortfolioConfig,
} from "../services/supabaseDb";

type ToastState = {
  visible: boolean;
  message: string;
};

type InvestioContextValue = {
  demoBalance: number;
  portfolio: InvestioAsset[];
  portfolioConfig: PortfolioConfig;
  toast: ToastState;
  user: User | null;
  authLoading: boolean;
  cloudSyncEnabled: boolean;
  showToast: (message: string) => void;
  addToPortfolio: (asset: InvestioAsset) => void;
  addFunds: (amount: number) => void;
  savePortfolioConfig: (config: NonNullable<PortfolioConfig>) => void;
  signOut: () => Promise<void>;
};

const InvestioContext = createContext<InvestioContextValue | undefined>(
  undefined,
);

const SAVE_DEBOUNCE_MS = 800;

export function InvestioProvider({ children }: { children: ReactNode }) {
  const [demoBalance, setDemoBalance] = useState(() =>
    Number(localStorage.getItem("investio_balance") || 25000),
  );

  const [portfolio, setPortfolio] = useState<InvestioAsset[]>(() =>
    JSON.parse(localStorage.getItem("investio_portfolio") || "[]"),
  );

  const [portfolioConfig, setPortfolioConfig] = useState<PortfolioConfig>(() =>
    JSON.parse(localStorage.getItem("investio_portfolio_config") || "null"),
  );

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const skipNextCloudSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cloudSyncEnabled = isSupabaseConfigured && user !== null;

  const persistLocal = useCallback(
    (balance: number, items: InvestioAsset[], config: PortfolioConfig) => {
      localStorage.setItem("investio_balance", String(balance));
      localStorage.setItem("investio_portfolio", JSON.stringify(items));
      localStorage.setItem(
        "investio_portfolio_config",
        JSON.stringify(config),
      );
    },
    [],
  );

  const scheduleCloudSave = useCallback(
    (balance: number, items: InvestioAsset[], config: PortfolioConfig) => {
      if (!user || !isSupabaseConfigured) return;

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        saveUserAppData(user, {
          demoBalance: balance,
          portfolio: items,
          portfolioConfig: config,
        }).catch((err) => {
          console.error("[Investio] cloud save failed:", err);
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [user],
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    let cancelled = false;

    (async () => {
      const remote = await loadUserAppData(user);
      if (cancelled || !remote) return;

      skipNextCloudSave.current = true;
      setDemoBalance(remote.demoBalance);
      setPortfolio(remote.portfolio);
      setPortfolioConfig(remote.portfolioConfig);
      persistLocal(
        remote.demoBalance,
        remote.portfolio,
        remote.portfolioConfig,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [user, persistLocal]);

  useEffect(() => {
    persistLocal(demoBalance, portfolio, portfolioConfig);

    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false;
      return;
    }

    scheduleCloudSave(demoBalance, portfolio, portfolioConfig);
  }, [
    demoBalance,
    portfolio,
    portfolioConfig,
    persistLocal,
    scheduleCloudSave,
  ]);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: "" }), 2500);
  };

  const addToPortfolio = (asset: InvestioAsset) => {
    setPortfolio((prev) => {
      if (prev.find((p) => p.name === asset.name)) return prev;
      return [...prev, asset];
    });
    showToast(`${asset.name} added to Demo Portfolio!`);
  };

  const addFunds = (amount: number) => {
    setDemoBalance((prev) => prev + amount);
    showToast(`R${amount.toLocaleString()} Demo Funds Added!`);
  };

  const savePortfolioConfig = (config: NonNullable<PortfolioConfig>) => {
    setPortfolioConfig(config);
    showToast("Demo Portfolio Created!");
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("investio_user");
  };

  return (
    <InvestioContext.Provider
      value={{
        demoBalance,
        portfolio,
        portfolioConfig,
        toast,
        user,
        authLoading,
        cloudSyncEnabled,
        showToast,
        addToPortfolio,
        addFunds,
        savePortfolioConfig,
        signOut,
      }}
    >
      {children}
    </InvestioContext.Provider>
  );
}

export const useInvestio = () => {
  const context = useContext(InvestioContext);
  if (!context) {
    throw new Error("useInvestio must be used within InvestioProvider");
  }
  return context;
};
