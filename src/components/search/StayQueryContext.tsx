"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { defaultStayQuery, type StayQuery } from "@/lib/search/stay-query";

type StayQueryContextValue = [StayQuery, (stay: StayQuery) => void];

const StayQueryContext = createContext<StayQueryContextValue | null>(null);

/**
 * Shares the home screen's date/guest picker state between HomeSearchBar
 * (which owns the picker UI) and PopularDestinations (rendered much lower
 * on the same page, not adjacent to it) — so tapping a destination card
 * carries over whatever the user already picked instead of silently
 * resetting to today/tomorrow/2 adults.
 */
export function StayQueryProvider({ children }: { children: ReactNode }) {
  const state = useState<StayQuery>(defaultStayQuery);
  return <StayQueryContext.Provider value={state}>{children}</StayQueryContext.Provider>;
}

export function useStayQuery(): StayQueryContextValue {
  const ctx = useContext(StayQueryContext);
  if (!ctx) throw new Error("useStayQuery must be used within a StayQueryProvider");
  return ctx;
}
