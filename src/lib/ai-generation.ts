import "server-only";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedMaterials, gradeLevels, learningResources, subjects } from "@/db/schema";
import { MATERIAL_SCHEMAS, systemPrompt, taskPrompt, type MaterialKind } from "@/lib/ai-materials";
import { resourceStoragePath } from "@/lib/learning-resources";

/** Generation runs in the background; one still "generating" after this long was interrupted. */
const GENERATION_TIMEOUT_MS = 15 * 60_000;

/** The status to show: a run still "generating" after the timeout was cut off by a restart. */
export function materialStatus(status: string, createdAt: Date) {
  if (status === "generating" && Date.now() - createdAt.getTime() > GENERATION_TIMEOUT_MS) return "interrupted";
  return status;
}

const TEXT_TYPES = [".txt", ".md", ".markdown", ".html", ".htm", ".csv"];

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Whether Claude can read this library file as a textbook. */
export function aiReadableResource(fileName: string) {
  const name = fileName.toLowerCase();
  return name.endsWith(".pdf") || TEXT_TYPES.some((extension) => name.endsWith(extension));
}

let client: Anthropic | undefined;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

type Resource = { id: string; schoolId: string; title: string; fileName: string; storageKey: string; contentType: string; aiFileId: string | null };

/** The textbook as a document block. PDFs go through the Files API once and are reused by id. */
async function textbookBlock(resource: Resource, forceUpload = false): Promise<Anthropic.Beta.BetaRequestDocumentBlock> {
  const path = resourceStoragePath(resource.schoolId, resource.storageKey);
  if (!existsSync(path)) throw new Error("The textbook file is missing from storage. Upload it again.");

  if (!resource.fileName.toLowerCase().endsWith(".pdf")) {
    return {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: await readFile(path, "utf8") },
      title: resource.title,
      cache_control: { type: "ephemeral" },
    };
  }

  let fileId = forceUpload ? null : resource.aiFileId;
  if (!fileId) {
    const uploaded = await anthropic().files.upload({
      file: await toFile(createReadStream(path), resource.fileName, { type: "application/pdf" }),
    });
    fileId = uploaded.id;
    await db.update(learningResources).set({ aiFileId: fileId }).where(eq(learningResources.id, resource.id));
  }
  return {
    type: "document",
    source: { type: "file", file_id: fileId },
    title: resource.title,
    // The textbook is the large, stable prefix: generating more material from it within a few
    // minutes reads it from the cache at a twentieth of the price.
    cache_control: { type: "ephemeral" },
  };
}

async function requestMaterial(params: {
  model: string;
  kind: MaterialKind;
  document: Anthropic.Beta.BetaRequestDocumentBlock;
  prompt: string;
}) {
  const stream = anthropic().beta.messages.stream({
    model: params.model,
    max_tokens: 32000,
    // On a policy decline the API retries on the model's default fallback inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(MATERIAL_SCHEMAS[params.kind]) },
    system: systemPrompt(),
    messages: [{ role: "user", content: [params.document, { type: "text", text: params.prompt }] }],
  });
  return stream.finalMessage();
}

function failureMessage(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. An administrator should check ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.PermissionDeniedError) return "The Anthropic API key isn't allowed to use this model.";
  if (error instanceof Anthropic.RateLimitError) return "Claude is busy right now (rate limit). Try again in a minute.";
  if (error instanceof Anthropic.BadRequestError) return `Claude couldn't accept this textbook: ${error.message}`.slice(0, 500);
  if (error instanceof Anthropic.APIConnectionError) return "Forma couldn't reach the Claude API. Check the server's internet connection and try again.";
  if (error instanceof Anthropic.APIError) return `The Claude API failed (${error.status ?? "no status"}). Try again.`;
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Generation failed.";
}

/** Writes the material for a row created with status "generating". Never throws. */
export async function runGeneration(materialId: string) {
  try {
    const [row] = await db.select({
      material: generatedMaterials,
      resource: {
        id: learningResources.id,
        schoolId: learningResources.schoolId,
        title: learningResources.title,
        fileName: learningResources.fileName,
        storageKey: learningResources.storageKey,
        contentType: learningResources.contentType,
        aiFileId: learningResources.aiFileId,
      },
      gradeName: gradeLevels.name,
      subjectName: subjects.name,
    })
      .from(generatedMaterials)
      .innerJoin(learningResources, eq(learningResources.id, generatedMaterials.resourceId))
      .leftJoin(gradeLevels, eq(gradeLevels.id, generatedMaterials.gradeLevelId))
      .leftJoin(subjects, eq(subjects.id, generatedMaterials.subjectId))
      .where(eq(generatedMaterials.id, materialId))
      .limit(1);
    if (!row) throw new Error("The textbook for this request was removed.");
    const { material, resource } = row;
    const kind = material.kind;
    const prompt = taskPrompt({ kind, scope: material.scope, gradeName: row.gradeName, subjectName: row.subjectName, instructions: material.instructions });

    let message;
    try {
      message = await requestMaterial({ model: material.model, kind, document: await textbookBlock(resource), prompt });
    } catch (error) {
      // A file deleted on Anthropic's side: upload the textbook again once.
      if (!(error instanceof Anthropic.NotFoundError) || !resource.aiFileId) throw error;
      message = await requestMaterial({ model: material.model, kind, document: await textbookBlock(resource, true), prompt });
    }

    if (message.stop_reason === "refusal") {
      throw new Error(`Claude declined this request${message.stop_details?.category ? ` (${message.stop_details.category})` : ""}. Rephrase the scope or notes and try again.`);
    }
    if (message.stop_reason === "max_tokens") throw new Error("The material came out too long. Choose a narrower scope.");
    const content = message.parsed_output;
    if (!content) throw new Error("Claude's answer couldn't be read. Try again.");

    await db.update(generatedMaterials).set({
      status: "ready",
      title: content.title.slice(0, 200) || material.title,
      content,
      model: message.model,
      inputTokens: message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0),
      cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
      outputTokens: message.usage.output_tokens,
      error: null,
    }).where(eq(generatedMaterials.id, materialId));
  } catch (error) {
    console.error(`[forma] generation ${materialId} failed:`, error);
    await db.update(generatedMaterials)
      .set({ status: "failed", error: failureMessage(error) })
      .where(eq(generatedMaterials.id, materialId))
      .catch(() => {});
  }
}
