import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  applyAddToPortfolio,
  createEmptyPortfolio,
  migrateLegacyPortfolio,
  type PortfoliosStore,
  type UserPortfolio,
} from "../types/portfolio";

type ToastState = {
  visible: boolean;
  message: string;
};

type InvestioContextValue = {
  demoBalance: number;
  portfolios: UserPortfolio[];
  activePortfolioId: string | null;
  activePortfolio: UserPortfolio | null;
  /** Holdings in the currently active portfolio (backward compatible). */
  portfolio: InvestioAsset[];
  portfolioConfig: PortfolioConfig;
  toast: ToastState;
  user: User | null;
  authLoading: boolean;
  cloudSyncEnabled: boolean;
  showToast: (message: string) => void;
  createPortfolio: (name: string, config?: PortfolioConfig) => string;
  deletePortfolio: (portfolioId: string) => void;
  setActivePortfolio: (portfolioId: string) => void;
  renamePortfolio: (portfolioId: string, name: string) => void;
  addToPortfolio: (asset: InvestioAsset, portfolioId?: string) => void;
  removeFromPortfolio: (assetId: string, portfolioId?: string) => void;
  addFunds: (amount: number) => void;
  savePortfolioConfig: (config: NonNullable<PortfolioConfig>) => void;
  signOut: () => Promise<void>;
};

const InvestioContext = createContext<InvestioContextValue | undefined>(
  undefined,
);

const SAVE_DEBOUNCE_MS = 800;

function loadPortfoliosStore(): PortfoliosStore {
  const stored = localStorage.getItem("investio_portfolios");
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PortfoliosStore;
      if (parsed.version === 2) {
        return {
          version: 2,
          activePortfolioId: parsed.activePortfolioId,
          portfolios: Array.isArray(parsed.portfolios) ? parsed.portfolios : [],
        };
      }
    } catch {
      /* fall through to legacy migration */
    }
  }

  try {
    const legacyHoldings = JSON.parse(
      localStorage.getItem("investio_portfolio") || "[]",
    ) as InvestioAsset[];
    const legacyConfig = JSON.parse(
      localStorage.getItem("investio_portfolio_config") || "null",
    ) as PortfolioConfig;
    return migrateLegacyPortfolio(legacyHoldings, legacyConfig);
  } catch {
    return { version: 2, activePortfolioId: null, portfolios: [] };
  }
}

export function InvestioProvider({ children }: { children: ReactNode }) {
  const [demoBalance, setDemoBalance] = useState(() =>
    Number(localStorage.getItem("investio_balance") || 25000),
  );

  const [portfoliosStore, setPortfoliosStore] = useState<PortfoliosStore>(
    loadPortfoliosStore,
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

  const activePortfolio = useMemo(
    () =>
      portfoliosStore.portfolios.find(
        (item) => item.id === portfoliosStore.activePortfolioId,
      ) ?? null,
    [portfoliosStore],
  );

  const portfolio = activePortfolio?.holdings ?? [];
  const portfolioConfig = activePortfolio?.config ?? null;

  const persistLocal = useCallback(
    (balance: number, store: PortfoliosStore) => {
      localStorage.setItem("investio_balance", String(balance));
      localStorage.setItem("investio_portfolios", JSON.stringify(store));
    },
    [],
  );

  const scheduleCloudSave = useCallback(
    (balance: number, store: PortfoliosStore) => {
      if (!user || !isSupabaseConfigured) return;

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        saveUserAppData(user, {
          demoBalance: balance,
          portfoliosStore: store,
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

    const authTimeout = window.setTimeout(() => {
      if (mounted) setAuthLoading(false);
    }, 5000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (mounted) setAuthLoading(false);
      })
      .finally(() => {
        window.clearTimeout(authTimeout);
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
      setPortfoliosStore(remote.portfoliosStore);
      persistLocal(remote.demoBalance, remote.portfoliosStore);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, persistLocal]);

  useEffect(() => {
    persistLocal(demoBalance, portfoliosStore);

    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false;
      return;
    }

    scheduleCloudSave(demoBalance, portfoliosStore);
  }, [demoBalance, portfoliosStore, persistLocal, scheduleCloudSave]);

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: "" }), 2800);
  }, []);

  const createPortfolio = (name: string, config: PortfolioConfig = null) => {
    const portfolio = createEmptyPortfolio(name, config);
    setPortfoliosStore((prev) => ({
      version: 2,
      activePortfolioId: portfolio.id,
      portfolios: [portfolio, ...prev.portfolios],
    }));
    showToast(`Portfolio "${portfolio.name}" created`);
    return portfolio.id;
  };

  const deletePortfolio = (portfolioId: string) => {
    setPortfoliosStore((prev) => {
      const next = prev.portfolios.filter((item) => item.id !== portfolioId);
      const activePortfolioId =
        prev.activePortfolioId === portfolioId
          ? (next[0]?.id ?? null)
          : prev.activePortfolioId;
      return { version: 2, activePortfolioId, portfolios: next };
    });
    showToast("Portfolio deleted");
  };

  const setActivePortfolio = (portfolioId: string) => {
    setPortfoliosStore((prev) => ({
      ...prev,
      activePortfolioId: portfolioId,
    }));
  };

  const renamePortfolio = (portfolioId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setPortfoliosStore((prev) => ({
      ...prev,
      portfolios: prev.portfolios.map((item) =>
        item.id === portfolioId ? { ...item, name: trimmed } : item,
      ),
    }));
  };

  const addToPortfolio = useCallback(
    (asset: InvestioAsset, portfolioId?: string) => {
      setPortfoliosStore((prev) => {
        const { store, message } = applyAddToPortfolio(prev, asset, portfolioId);
        if (message) {
          queueMicrotask(() => showToast(message));
        }
        return store;
      });
    },
    [showToast],
  );

  const removeFromPortfolio = (assetId: string, portfolioId?: string) => {
    const targetId = portfolioId ?? portfoliosStore.activePortfolioId;
    if (!targetId) return;

    setPortfoliosStore((prev) => ({
      ...prev,
      portfolios: prev.portfolios.map((item) =>
        item.id === targetId
          ? {
              ...item,
              holdings: item.holdings.filter((asset) => asset.id !== assetId),
            }
          : item,
      ),
    }));
    showToast("Removed from portfolio");
  };

  const addFunds = (amount: number) => {
    setDemoBalance((prev) => prev + amount);
    showToast(`R${amount.toLocaleString()} Demo Funds Added!`);
  };

  const savePortfolioConfig = (config: NonNullable<PortfolioConfig>) => {
    const targetId = portfoliosStore.activePortfolioId;
    if (!targetId) {
      createPortfolio("My Demo Portfolio", config);
      return;
    }

    setPortfoliosStore((prev) => ({
      ...prev,
      portfolios: prev.portfolios.map((item) =>
        item.id === targetId ? { ...item, config } : item,
      ),
    }));
    showToast("Portfolio settings saved");
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
        portfolios: portfoliosStore.portfolios,
        activePortfolioId: portfoliosStore.activePortfolioId,
        activePortfolio,
        portfolio,
        portfolioConfig,
        toast,
        user,
        authLoading,
        cloudSyncEnabled,
        showToast,
        createPortfolio,
        deletePortfolio,
        setActivePortfolio,
        renamePortfolio,
        addToPortfolio,
        removeFromPortfolio,
        addFunds,
        savePortfolioConfig,
        signOut,
      }}
    >
      {children}
    </InvestioContext.Provider>
  );
};

export const useInvestio = () => {
  const context = useContext(InvestioContext);
  if (!context) {
    throw new Error("useInvestio must be used within InvestioProvider");
  }
  return context;
};
