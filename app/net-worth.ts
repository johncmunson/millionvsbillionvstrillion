export const MAX_SOURCES = 3;
export const MAX_ALIASES = 4;
export const NET_WORTH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type NetWorthLookupStatus = "found" | "not_found" | "ambiguous";

export type NetWorthSource = {
  title: string;
  url: string;
};

export type NetWorthLookupResult = {
  status: NetWorthLookupStatus;
  name: string;
  estimated_net_worth: number | null;
  sources: NetWorthSource[];
  message?: string | null;
  qualifier_example?: string | null;
};

export const MIN_VISUALIZED_NET_WORTH = 1_000_000;
export const MAX_VISUALIZED_NET_WORTH = 1_000_000_000_000;
