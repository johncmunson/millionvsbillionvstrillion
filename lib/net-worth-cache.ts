import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";
import {
  MAX_ALIASES,
  MAX_SOURCES,
  NET_WORTH_CACHE_TTL_MS,
  type NetWorthLookupResult,
  type NetWorthSource,
} from "@/app/net-worth";
import { getDb } from "@/db";
import {
  netWorthCacheEntries,
  netWorthCacheLookupKeys,
} from "@/db/schema";

type LookupKeyKind = "name" | "alias";

type LookupKeyCandidate = {
  lookupKey: string;
  displayValue: string;
  kind: LookupKeyKind;
};

export type CacheNetWorthLookupInput = {
  resolvedName: string;
  estimatedNetWorth: number;
  sources: NetWorthSource[];
  aliases: string[];
};

export function normalizeNetWorthLookupKey(value: string): string | null {
  const normalized = value
    .trim()
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export function normalizeNetWorthSourceUrl(url: string) {
  const trimmedUrl = url.trim();

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null;
    }

    return parsedUrl.href;
  } catch {
    return null;
  }
}

export function normalizeNetWorthSources(
  sources: readonly NetWorthSource[],
): NetWorthSource[] {
  const sourceMap = new Map<string, NetWorthSource>();

  for (const source of sources) {
    const title = source.title.trim();
    const url = normalizeNetWorthSourceUrl(source.url);

    if (!title || !url || sourceMap.has(url)) {
      continue;
    }

    sourceMap.set(url, { title, url });
  }

  return Array.from(sourceMap.values()).slice(0, MAX_SOURCES);
}

function sourceFromUnknown(value: unknown): NetWorthSource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeSource = value as Record<string, unknown>;

  if (
    typeof maybeSource.title !== "string" ||
    typeof maybeSource.url !== "string"
  ) {
    return null;
  }

  return {
    title: maybeSource.title,
    url: maybeSource.url,
  };
}

export function parseNetWorthSources(value: unknown): NetWorthSource[] {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  const sources = parsedValue.flatMap((source) => {
    const normalizedSource = sourceFromUnknown(source);
    return normalizedSource ? [normalizedSource] : [];
  });

  return normalizeNetWorthSources(sources);
}

function buildLookupKeyCandidates(input: CacheNetWorthLookupInput) {
  const resolvedName = input.resolvedName.trim();
  const canonicalLookupKey = normalizeNetWorthLookupKey(resolvedName);

  if (!resolvedName || !canonicalLookupKey) {
    return [];
  }

  const candidates: LookupKeyCandidate[] = [
    {
      lookupKey: canonicalLookupKey,
      displayValue: resolvedName,
      kind: "name",
    },
  ];
  const seenLookupKeys = new Set([canonicalLookupKey]);
  let aliasCount = 0;

  for (const alias of input.aliases) {
    if (aliasCount >= MAX_ALIASES) {
      break;
    }

    const displayValue = alias.trim();
    const lookupKey = normalizeNetWorthLookupKey(displayValue);

    if (!displayValue || !lookupKey || seenLookupKeys.has(lookupKey)) {
      continue;
    }

    seenLookupKeys.add(lookupKey);
    aliasCount += 1;
    candidates.push({
      lookupKey,
      displayValue,
      kind: "alias",
    });
  }

  return candidates;
}

export async function readNetWorthLookupCache(
  lookupKey: string,
  now = Date.now(),
): Promise<NetWorthLookupResult | null> {
  const [row] = await getDb()
    .select({
      resolvedName: netWorthCacheEntries.resolvedName,
      estimatedNetWorth: netWorthCacheEntries.estimatedNetWorth,
      sources: netWorthCacheEntries.sources,
    })
    .from(netWorthCacheLookupKeys)
    .innerJoin(
      netWorthCacheEntries,
      eq(
        netWorthCacheLookupKeys.cacheEntryId,
        netWorthCacheEntries.id,
      ),
    )
    .where(
      and(
        eq(netWorthCacheLookupKeys.lookupKey, lookupKey),
        gt(netWorthCacheEntries.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const sources = parseNetWorthSources(row.sources);
  const estimatedNetWorth = Number(row.estimatedNetWorth);
  const resolvedName = row.resolvedName.trim();

  if (
    !resolvedName ||
    !Number.isFinite(estimatedNetWorth) ||
    estimatedNetWorth <= 0 ||
    sources.length === 0
  ) {
    return null;
  }

  return {
    status: "found",
    name: resolvedName,
    estimated_net_worth: Math.round(estimatedNetWorth),
    sources,
    message: null,
    qualifier_example: null,
  };
}

export async function cacheNetWorthLookup(input: CacheNetWorthLookupInput) {
  const resolvedName = input.resolvedName.trim();
  const estimatedNetWorth = Math.round(input.estimatedNetWorth);
  const sources = normalizeNetWorthSources(input.sources);
  const candidates = buildLookupKeyCandidates({
    ...input,
    resolvedName,
    estimatedNetWorth,
    sources,
  });

  if (
    !resolvedName ||
    !Number.isFinite(estimatedNetWorth) ||
    estimatedNetWorth <= 0 ||
    sources.length === 0 ||
    candidates.length === 0
  ) {
    return;
  }

  const now = Date.now();
  const lookupKeys = candidates.map((candidate) => candidate.lookupKey);

  await getDb().transaction(async (tx) => {
    const existingRows = await tx
      .select({
        lookupKey: netWorthCacheLookupKeys.lookupKey,
        cacheEntryId: netWorthCacheLookupKeys.cacheEntryId,
        expiresAt: netWorthCacheEntries.expiresAt,
      })
      .from(netWorthCacheLookupKeys)
      .innerJoin(
        netWorthCacheEntries,
        eq(
          netWorthCacheLookupKeys.cacheEntryId,
          netWorthCacheEntries.id,
        ),
      )
      .where(inArray(netWorthCacheLookupKeys.lookupKey, lookupKeys));

    const expiredCacheEntryIds = Array.from(
      new Set(
        existingRows
          .filter((row) => row.expiresAt <= now)
          .map((row) => row.cacheEntryId),
      ),
    );

    if (expiredCacheEntryIds.length > 0) {
      await tx
        .delete(netWorthCacheLookupKeys)
        .where(
          inArray(
            netWorthCacheLookupKeys.cacheEntryId,
            expiredCacheEntryIds,
          ),
        );
      await tx
        .delete(netWorthCacheEntries)
        .where(inArray(netWorthCacheEntries.id, expiredCacheEntryIds));
    }

    const activeConflictKeys = new Set(
      existingRows
        .filter((row) => row.expiresAt > now)
        .map((row) => row.lookupKey),
    );
    const canonicalLookupKey = candidates[0]?.lookupKey;

    if (!canonicalLookupKey || activeConflictKeys.has(canonicalLookupKey)) {
      return;
    }

    const safeCandidates = candidates.filter(
      (candidate) =>
        candidate.kind === "name" || !activeConflictKeys.has(candidate.lookupKey),
    );

    const [insertedEntry] = await tx
      .insert(netWorthCacheEntries)
      .values({
        resolvedName,
        estimatedNetWorth,
        sources,
        createdAt: now,
        expiresAt: now + NET_WORTH_CACHE_TTL_MS,
        updatedAt: now,
      })
      .returning({ id: netWorthCacheEntries.id });

    if (!insertedEntry) {
      throw new Error("Failed to insert net worth cache entry.");
    }

    await tx.insert(netWorthCacheLookupKeys).values(
      safeCandidates.map((candidate) => ({
        cacheEntryId: insertedEntry.id,
        lookupKey: candidate.lookupKey,
        displayValue: candidate.displayValue,
        kind: candidate.kind,
        createdAt: now,
      })),
    );
  });
}
