import { openai } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs } from "ai";
import { after } from "next/server";
import { z } from "zod";
import {
  MAX_ALIASES,
  MAX_SOURCES,
  type NetWorthLookupResult,
} from "../../net-worth";
import {
  cacheNetWorthLookup,
  normalizeNetWorthLookupKey,
  normalizeNetWorthSources,
  readNetWorthLookupCache,
} from "@/lib/net-worth-cache";
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

export const maxDuration = 30;

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const lookupOutputSchema = z.object({
  status: z
    .enum(["found", "not_found", "ambiguous"])
    .describe(
      "Use found when a credible net worth estimate exists, not_found when no public estimate can be found, and ambiguous when the name could refer to multiple plausible public figures.",
    ),
  name: z
    .string()
    .describe(
      "The resolved public figure name. This will often match the user's submitted name, but not always (e.g., User Submitted: 'The Rock' -> Resolved Name: 'Dwayne Johnson').",
    ),
  estimated_net_worth: z
    .number()
    .nullable()
    .describe(
      "Estimated net worth in current US dollars. Use a numeric USD value only for status found; otherwise null.",
    ),
  sources: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "Short, human-readable source title, e.g. Forbes, Bloomberg, Wikipedia.",
          ),
        url: z
          .string()
          .describe("Absolute HTTP or HTTPS URL for the source page used for the estimate."),
      }),
    )
    .describe(
      `Sources used for the estimate, including titles and URLs. The most credible sources should be listed first, stale or less credible sources at the end. Max ${MAX_SOURCES} sources.`,
    ),
  message: z
    .string()
    .nullable()
    .describe(
      "A short explanatory message for not_found or ambiguous. Use null for found.",
    ),
  qualifier_example: z
    .string()
    .nullable()
    .describe(
      "For ambiguous names, an example of a clearer query using a qualifier, e.g. 'Robert Smith, the investor not the musician'. Use null otherwise.",
    ),
  is_cacheable: z
    .boolean()
    .describe(
      "True only when the resolved public figure is sufficiently unambiguous for cache lookup and will not shadow other wealthy public figures with the same name. False for ambiguous, not-found, or uncertain results.",
    ),
  aliases: z
    .array(z.string())
    .describe(
      `Up to ${MAX_ALIASES} other unambiguous names the same person goes by. Exclude the canonical resolved name. Do not include ambiguous abbreviations like MJ. Use an empty array when none are known.`,
    ),
});

type LookupOutput = z.infer<typeof lookupOutputSchema>;

type NormalizedLookupOutput = {
  result: NetWorthLookupResult;
  isCacheable: boolean;
  aliases: string[];
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function rateLimitHeaders(rateLimit: RateLimitResult) {
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
  );

  return {
    "Retry-After": retryAfterSeconds.toString(),
    "X-RateLimit-Limit": rateLimit.limit.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
  };
}

function normalizeAliases(aliases: string[], resolvedName: string) {
  const canonicalLookupKey = normalizeNetWorthLookupKey(resolvedName);
  const seenLookupKeys = new Set<string>();
  const normalizedAliases: string[] = [];

  for (const alias of aliases) {
    if (normalizedAliases.length >= MAX_ALIASES) {
      break;
    }

    const trimmedAlias = alias.trim();
    const lookupKey = normalizeNetWorthLookupKey(trimmedAlias);

    if (
      !trimmedAlias ||
      !lookupKey ||
      lookupKey === canonicalLookupKey ||
      seenLookupKeys.has(lookupKey)
    ) {
      continue;
    }

    seenLookupKeys.add(lookupKey);
    normalizedAliases.push(trimmedAlias);
  }

  return normalizedAliases;
}

function normalizeOutput(
  output: LookupOutput,
  submittedName: string,
): NormalizedLookupOutput {
  const normalizedStatus = output.status;
  const resolvedName = output.name.trim();
  const sources = normalizeNetWorthSources(output.sources);
  const estimatedNetWorth =
    normalizedStatus === "found" &&
    typeof output.estimated_net_worth === "number" &&
    Number.isFinite(output.estimated_net_worth) &&
    output.estimated_net_worth > 0
      ? Math.round(output.estimated_net_worth)
      : null;

  const status =
    normalizedStatus === "found" &&
    (estimatedNetWorth === null || sources.length === 0)
      ? "not_found"
      : normalizedStatus;
  const resultName = resolvedName || submittedName;

  return {
    result: {
      status,
      name: resultName,
      estimated_net_worth: status === "found" ? estimatedNetWorth : null,
      sources: status === "found" ? sources : [],
      message: output.message?.trim() || null,
      qualifier_example: output.qualifier_example?.trim() || null,
    },
    isCacheable: output.is_cacheable === true,
    aliases: normalizeAliases(output.aliases, resultName),
  };
}

function isCacheEligible(normalizedOutput: NormalizedLookupOutput) {
  const { result } = normalizedOutput;

  return (
    result.status === "found" &&
    normalizedOutput.isCacheable &&
    typeof result.estimated_net_worth === "number" &&
    Number.isFinite(result.estimated_net_worth) &&
    result.estimated_net_worth > 0 &&
    result.sources.length > 0 &&
    result.name.trim().length > 0
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please provide a public figure name.", 400);
  }

  const { name } = parsed.data;
  const submittedLookupKey = normalizeNetWorthLookupKey(name);

  if (submittedLookupKey) {
    try {
      const cachedResult = await readNetWorthLookupCache(submittedLookupKey);

      if (cachedResult) {
        return Response.json(cachedResult);
      }
    } catch (error) {
      console.error("Failed to read net worth lookup cache", error);
    }
  }

  try {
    const rateLimit = await checkRateLimit(request);

    if (rateLimit.rateLimited) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
  } catch (error) {
    console.error("Failed to check net worth rate limit", error);
    return jsonError("Unable to process request right now.", 500);
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-5.5"),
      tools: {
        web_search: openai.tools.webSearch({ searchContextSize: "high" }),
      },
      output: Output.object({
        schema: lookupOutputSchema,
      }),
      stopWhen: stepCountIs(5),
      system:
        `You research public-figure net worth estimates. Use web_search for current, publicly available net worth estimates and credible sources. Prefer reputable sources such as Forbes, Bloomberg, official rich lists, Wikipedia pages that cite financial sources, and major business publications. Return only the structured output requested by the schema. Do not invent figures, sources, URLs, or aliases. Do not perform web searches solely to discover aliases. Only include aliases that are unambiguous on their own. Set is_cacheable to false for ambiguous, not-found, or uncertain results. Limit sources to ${MAX_SOURCES} and aliases to ${MAX_ALIASES}.`,
      prompt: `Find the current publicly available estimated net worth for this person: ${name}

Rules:
- If the name clearly identifies one public figure and credible current net worth data is available, return status "found", the resolved name, estimated_net_worth as a numeric USD value, and sources as objects with source titles and absolute URLs.
- If no credible public net worth estimate is available, return status "not_found" with estimated_net_worth null, no sources, is_cacheable false, and aliases as an empty array.
- If the name is too generic or ambiguous, return status "ambiguous", estimated_net_worth null, no sources, is_cacheable false, and provide a qualifier_example such as "Jeff Bridges, the actor".
- Use USD. Convert shorthand like "$250B" to 250000000000.
- If there are multiple conflicting estimates, use your best judgement to determine the most credible figure and source, placing more weight on recent estimates from reputable sources.
- Return at most ${MAX_SOURCES} source objects. Do not invent sources or URLs. Sources must be HTTP or HTTPS URLs.
- Set is_cacheable true only if the resolved public figure name is sufficiently unambiguous and safe to use as a cache lookup key without shadowing other wealthy public figures with the same name.
- Set is_cacheable false for ambiguous, not-found, or uncertain results, results without sources, or results with unknown or unavailable net worth.
- Include up to ${MAX_ALIASES} aliases only when they are already known or encountered incidentally during net worth research. Do not perform extra web searches solely to discover aliases.
- Aliases must be safe lookup keys and unambiguous on their own. Do not include ambiguous abbreviations like "MJ".
- Aliases should exclude the canonical resolved name and should be an empty array when none are known.
- If the submitted name is an unambiguous alternate name for the resolved person, it may be included in aliases.`,
    });

    const normalizedOutput = normalizeOutput(output, name);
    const { result } = normalizedOutput;

    if (isCacheEligible(normalizedOutput)) {
      after(async () => {
        try {
          await cacheNetWorthLookup({
            resolvedName: result.name,
            estimatedNetWorth: result.estimated_net_worth!,
            sources: result.sources,
            aliases: normalizedOutput.aliases,
          });
        } catch (error) {
          console.error("Failed to cache net worth lookup", error);
        }
      });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Net worth lookup failed", error);
    return jsonError("Unable to look up net worth data right now.", 500);
  }
}
