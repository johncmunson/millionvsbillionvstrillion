export type NetWorthLookupStatus = "found" | "not_found" | "ambiguous";

export type NetWorthSource = {
  name: string;
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
