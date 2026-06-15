import { openai } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs } from "ai";
import { z } from "zod";
import type { NetWorthLookupResult } from "../../net-worth";

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
      "The resolved public figure name, or the user's submitted name if no unambiguous person was resolved.",
    ),
  estimated_net_worth: z
    .number()
    .nullable()
    .describe(
      "Estimated net worth in current US dollars. Use a numeric USD value only for status found; otherwise null.",
    ),
  sources: z
    .array(z.string())
    .describe(
      "Short, human-readable source names used for the estimate, e.g. Forbes, Bloomberg, Wikipedia.",
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
      "For ambiguous names, an example of a clearer query using a qualifier. Use null otherwise.",
    ),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
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
    sources: Array.from(
      new Set(
        output.sources
          .map((source) => source.trim())
          .filter((source) => source.length > 0),
      ),
    ).slice(0, 4),
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
        "You research public-figure net worth estimates. Use web_search for current, publicly available sources. Prefer reputable sources such as Forbes, Bloomberg, official rich lists, Wikipedia pages that cite financial sources, and major business publications. Return only the structured output requested by the schema. Do not invent figures or sources.",
      prompt: `Find the current publicly available estimated net worth for this person: ${name}\n\nRules:\n- If the name clearly identifies one public figure and credible current net worth data is available, return status "found", the resolved name, estimated_net_worth as a numeric USD value, and source names.\n- If no credible public net worth estimate is available, return status "not_found" with estimated_net_worth null and no sources.\n- If the name is too generic or ambiguous, return status "ambiguous", estimated_net_worth null, and provide a qualifier_example such as "${name}, the actor".\n- Use USD. Convert shorthand like "$250B" to 250000000000.`,
    });

    return Response.json(normalizeOutput(output, name));
  } catch (error) {
    console.error("Net worth lookup failed", error);
    return jsonError("Unable to look up net worth data right now.", 500);
  }
}
