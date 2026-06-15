import { openai } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs } from "ai";
import { z } from "zod";
import type { NetWorthLookupResult, NetWorthSource } from "../../net-worth";

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
        name: z
          .string()
          .describe(
            "Short, human-readable source name, e.g. Forbes, Bloomberg, Wikipedia.",
          ),
        url: z
          .string()
          .describe("Absolute URL for the source page used for the estimate."),
      }),
    )
    .describe(
      "Sources used for the estimate, including names and URLs. The most credible sources should be listed first, stale or less credible sources at the end. Max 3 sources.",
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
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function normalizeSourceUrl(url: string) {
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

function normalizeSources(
  sources: z.infer<typeof lookupOutputSchema>["sources"],
) {
  const sourceMap = new Map<string, NetWorthSource>();

  for (const source of sources) {
    const name = source.name.trim();
    const url = normalizeSourceUrl(source.url);

    if (!name || !url || sourceMap.has(url)) {
      continue;
    }

    sourceMap.set(url, { name, url });
  }

  return Array.from(sourceMap.values()).slice(0, 4);
}

function normalizeOutput(
  output: z.infer<typeof lookupOutputSchema>,
  submittedName: string,
): NetWorthLookupResult {
  const normalizedStatus = output.status;
  const estimatedNetWorth =
    normalizedStatus === "found" &&
    typeof output.estimated_net_worth === "number" &&
    Number.isFinite(output.estimated_net_worth) &&
    output.estimated_net_worth > 0
      ? Math.round(output.estimated_net_worth)
      : null;

  const status =
    normalizedStatus === "found" && estimatedNetWorth === null
      ? "not_found"
      : normalizedStatus;

  return {
    status,
    name: output.name.trim() || submittedName,
    estimated_net_worth: status === "found" ? estimatedNetWorth : null,
    sources: status === "found" ? normalizeSources(output.sources) : [],
    message: output.message?.trim() || null,
    qualifier_example: output.qualifier_example?.trim() || null,
  };
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
        "You research public-figure net worth estimates. Use web_search for current, publicly available sources. Prefer reputable sources such as Forbes, Bloomberg, official rich lists, Wikipedia pages that cite financial sources, and major business publications. Return only the structured output requested by the schema. Do not invent figures, sources, or URLs.",
      prompt: `Find the current publicly available estimated net worth for this person: ${name}

Rules:
- If the name clearly identifies one public figure and credible current net worth data is available, return status "found", the resolved name, estimated_net_worth as a numeric USD value, and sources as objects with source names and absolute URLs.
- If no credible public net worth estimate is available, return status "not_found" with estimated_net_worth null and no sources.
- If the name is too generic or ambiguous, return status "ambiguous", estimated_net_worth null, and provide a qualifier_example such as "Jeff Bridges, the actor".
- Use USD. Convert shorthand like "$250B" to 250000000000.
- If there are multiple conflicting estimates, use your best judgement to determine the most credible figure and source, placing more weight on recent estimates from reputable sources.`,
    });

    return Response.json(normalizeOutput(output, name));
  } catch (error) {
    console.error("Net worth lookup failed", error);
    return jsonError("Unable to look up net worth data right now.", 500);
  }
}
