"use client";

import { useState } from "react";
import HeroHeader from "./hero-header";
import { MIN_VISUALIZED_NET_WORTH } from "./net-worth";
import type { NetWorthLookupResult } from "./net-worth";
import ZoomableGrid from "./zoomable-grid";

type WealthExperienceProps = {
  ampersandClass: string;
};

export default function WealthExperience({
  ampersandClass,
}: WealthExperienceProps) {
  const [highlightedNetWorth, setHighlightedNetWorth] = useState<number | null>(
    null,
  );

  const handleLookupResult = (result: NetWorthLookupResult) => {
    setHighlightedNetWorth(
      result.status === "found" &&
        result.estimated_net_worth !== null &&
        result.estimated_net_worth >= MIN_VISUALIZED_NET_WORTH
        ? result.estimated_net_worth
        : null,
    );
  };

  const handleReset = () => {
    setHighlightedNetWorth(null);
  };

  return (
    <>
      <HeroHeader
        ampersandClass={ampersandClass}
        onLookupResult={handleLookupResult}
        onReset={handleReset}
      />
      <ZoomableGrid highlightedNetWorth={highlightedNetWorth} />
    </>
  );
}
