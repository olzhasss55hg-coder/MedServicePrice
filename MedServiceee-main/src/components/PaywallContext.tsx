"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { SearchQuota } from "@/lib/types";
import { PaywallModal } from "./PaywallModal";

interface PaywallContextType {
  quota: SearchQuota | null;
  loadingQuota: boolean;
  refreshQuota: () => Promise<void>;
  openPaywall: (reason?: "limit_reached" | "manual" | "vip_booking") => void;
  closePaywall: () => void;
  isPaywallOpen: boolean;
  isLimitReached: boolean;
}

const PaywallContext = createContext<PaywallContextType | undefined>(undefined);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [quota, setQuota] = useState<SearchQuota | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<"limit_reached" | "manual" | "vip_booking">("manual");

  const refreshQuota = useCallback(async () => {
    try {
      const data = await api.getSearchQuota();
      setQuota(data);
    } catch {
      // Fallback
    } finally {
      setLoadingQuota(false);
    }
  }, []);

  useEffect(() => {
    refreshQuota();

    const handleQuotaEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SearchQuota>;
      if (customEvent.detail) {
        setQuota(customEvent.detail);
      } else {
        refreshQuota();
      }
    };

    const handleOpenPaywallEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ reason?: "limit_reached" | "manual" | "vip_booking" }>;
      setPaywallReason(customEvent.detail?.reason || "manual");
      setIsPaywallOpen(true);
    };

    window.addEventListener("search-quota-updated", handleQuotaEvent);
    window.addEventListener("open-paywall", handleOpenPaywallEvent);
    return () => {
      window.removeEventListener("search-quota-updated", handleQuotaEvent);
      window.removeEventListener("open-paywall", handleOpenPaywallEvent);
    };
  }, [refreshQuota]);

  const openPaywall = (reason: "limit_reached" | "manual" | "vip_booking" = "manual") => {
    setPaywallReason(reason);
    setIsPaywallOpen(true);
  };

  const closePaywall = () => {
    setIsPaywallOpen(false);
  };

  const isLimitReached = Boolean(
    quota && 
    !quota.is_unlimited && 
    quota.search_limit !== null && 
    quota.searches_used >= quota.search_limit
  );

  return (
    <PaywallContext.Provider
      value={{
        quota,
        loadingQuota,
        refreshQuota,
        openPaywall,
        closePaywall,
        isPaywallOpen,
        isLimitReached,
      }}
    >
      {children}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
        quota={quota}
        reason={paywallReason}
        onSuccess={() => {
          refreshQuota();
        }}
      />
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error("usePaywall must be used within a PaywallProvider");
  }
  return context;
}
