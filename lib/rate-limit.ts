import "server-only";

import { ipAddress } from "@vercel/functions";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { netWorthRateLimits } from "@/db/schema";

export const NET_WORTH_RATE_LIMIT_REQUESTS = 10;
export const NET_WORTH_RATE_LIMIT_IP_WHITELIST: readonly string[] = [
  "24.217.35.5",
];

const netWorthRateLimitIpWhitelist = new Set(NET_WORTH_RATE_LIMIT_IP_WHITELIST);
const UNKNOWN_IP_ADDRESS = "unknown";
const MAX_IP_ADDRESS_LENGTH = 256;

type RateLimitWindow = {
  windowDate: string;
  resetAt: number;
};

export type RateLimitResult = {
  rateLimited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

function getUtcRateLimitWindow(now: Date): RateLimitWindow {
  const windowDate = now.toISOString().slice(0, 10);
  const resetAt = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );

  return { windowDate, resetAt };
}

function getForwardedForIpAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}

function getRequestIpAddress(request: Request) {
  const requestIp =
    ipAddress(request)?.trim() || getForwardedForIpAddress(request);
  const normalizedIp = requestIp?.slice(0, MAX_IP_ADDRESS_LENGTH).trim();

  return normalizedIp || UNKNOWN_IP_ADDRESS;
}

function isRateLimitWhitelisted(ip: string) {
  return netWorthRateLimitIpWhitelist.has(ip);
}

export async function checkRateLimit(
  request: Request,
  now = new Date(),
): Promise<RateLimitResult> {
  const timestamp = now.getTime();
  const ip = getRequestIpAddress(request);
  const { windowDate, resetAt } = getUtcRateLimitWindow(now);

  if (isRateLimitWhitelisted(ip)) {
    return {
      rateLimited: false,
      limit: NET_WORTH_RATE_LIMIT_REQUESTS,
      remaining: NET_WORTH_RATE_LIMIT_REQUESTS,
      resetAt,
    };
  }

  return getDb().transaction(async (tx) => {
    await tx
      .insert(netWorthRateLimits)
      .values({
        ipAddress: ip,
        windowDate,
        requestCount: 0,
        resetAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing({
        target: [netWorthRateLimits.ipAddress, netWorthRateLimits.windowDate],
      });

    const [updatedRow] = await tx
      .update(netWorthRateLimits)
      .set({
        requestCount: sql`${netWorthRateLimits.requestCount} + 1`,
        resetAt,
        updatedAt: timestamp,
      })
      .where(
        and(
          eq(netWorthRateLimits.ipAddress, ip),
          eq(netWorthRateLimits.windowDate, windowDate),
          lt(netWorthRateLimits.requestCount, NET_WORTH_RATE_LIMIT_REQUESTS),
        ),
      )
      .returning({ requestCount: netWorthRateLimits.requestCount });

    if (!updatedRow) {
      return {
        rateLimited: true,
        limit: NET_WORTH_RATE_LIMIT_REQUESTS,
        remaining: 0,
        resetAt,
      };
    }

    const requestCount = Number(updatedRow.requestCount);

    return {
      rateLimited: false,
      limit: NET_WORTH_RATE_LIMIT_REQUESTS,
      remaining: Math.max(0, NET_WORTH_RATE_LIMIT_REQUESTS - requestCount),
      resetAt,
    };
  });
}
