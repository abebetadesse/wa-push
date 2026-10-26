import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type ReportSection = "lessons" | "attendance" | "assessments" | "facilities" | "general";

export type TranscriptionResult = {
  success: boolean;
  transcription: string;
  detectedSection?: ReportSection;
  suggestedTitle?: string;
  wordCount?: number;
  message?: string;
};

let client: Anthropic | undefined;
function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  });
  return client;
}

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Transcribes handwritten or printed teacher report photos using Claude Vision.
 */
export async function transcribeReportPhoto(params: {
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  selectedSection?: ReportSection;
  contextHint?: string;
}): Promise<TranscriptionResult> {
  const { base64Data, mediaType, selectedSection, contextHint } = params;

  if (!isTranscriptionConfigured()) {
    const sectionHint = selectedSection || "general";
    const starterTemplate = getStarterTemplate(sectionHint);
    return {
      success: false,
      transcription: starterTemplate,
      detectedSection: selectedSection || "general",
      suggestedTitle: getDefaultTitle(sectionHint),
      message: "AI transcription requires ANTHROPIC_API_KEY in your .env file. A structured template has been provided so you can edit the report directly.",
    };
  }

  try {
    const anthropic = getAnthropicClient();
    const promptText = `You are an expert school administrative assistant and OCR specialist.
The user has provided a photo taken by a teacher of an educational report, classroom sheet, handwritten notes, or student records.
Target section: ${selectedSection ?? "unknown (please detect)"}.
${contextHint ? `Context: ${contextHint}` : ""}

YOUR TASKS:
1. Accurately transcribe all readable handwritten and printed text from the image.
2. Structure the transcribed text cleanly using Markdown:
   - Use headings (##, ###) for headers/sections.
   - Use Markdown tables or bullet lists for student rosters, attendance marks, or test scores.
   - If there are dates, teacher names, subjects, topics, or numbers, preserve them verbatim.
   - If any handwriting is unclear or smudged, write [illegible].
3. At the very top of your response, output two metadata tags enclosed in XML brackets:
   <suggested_title>Brief descriptive title for this report</suggested_title>
   <detected_section>lessons|attendance|assessments|facilities|general</detected_section>
Followed by the full markdown transcription.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: promptText,
            },
          ],
        },
      ],
    });

    const contentBlock = response.content[0];
    const rawText = contentBlock?.type === "text" ? contentBlock.text : "";

    let suggestedTitle: string | undefined;
    let detectedSection: ReportSection | undefined;
    let cleanTranscription = rawText;

    const titleMatch = cleanTranscription.match(/<suggested_title>(.*?)<\/suggested_title>/i);
    if (titleMatch) {
      suggestedTitle = titleMatch[1].trim();
      cleanTranscription = cleanTranscription.replace(/<suggested_title>.*?<\/suggested_title>/i, "").trim();
    }

    const sectionMatch = cleanTranscription.match(/<detected_section>(.*?)<\/detected_section>/i);
    if (sectionMatch) {
      const sec = sectionMatch[1].trim().toLowerCase() as ReportSection;
      if (["lessons", "attendance", "assessments", "facilities", "general"].includes(sec)) {
        detectedSection = sec;
      }
      cleanTranscription = cleanTranscription.replace(/<detected_section>.*?<\/detected_section>/i, "").trim();
    }

    const wordCount = cleanTranscription.split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      transcription: cleanTranscription,
      detectedSection: detectedSection || selectedSection || "general",
      suggestedTitle: suggestedTitle || getDefaultTitle(selectedSection || "general"),
      wordCount,
    };
  } catch (error) {
    console.error("[transcription] error transcribing photo:", error);
    const fallbackTemplate = getStarterTemplate(selectedSection || "general");
    return {
      success: false,
      transcription: fallbackTemplate,
      detectedSection: selectedSection || "general",
      suggestedTitle: getDefaultTitle(selectedSection || "general"),
      message: error instanceof Error ? error.message : "Failed to transcribe photo. You can type or edit your report text manually.",
    };
  }
}

function getDefaultTitle(section: ReportSection): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  switch (section) {
    case "lessons":
      return `Lesson Delivery & Field Report - ${dateStr}`;
    case "attendance":
      return `Classroom Attendance Log - ${dateStr}`;
    case "assessments":
      return `Student Assessment Score Sheet - ${dateStr}`;
    case "facilities":
      return `Lab & Facility Observation Note - ${dateStr}`;
    default:
      return `Teacher Activity Report - ${dateStr}`;
  }
}

function getStarterTemplate(section: ReportSection): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  switch (section) {
    case "lessons":
      return `## Lesson Delivery Report\n**Date:** ${dateStr}\n**Class / Subject:** \n**Lesson Topic:** \n\n### Objectives Covered:\n- \n\n### Student Engagement & Feedback:\n- \n\n### Notes & Homework Assigned:\n- `;
    case "attendance":
      return `## Attendance Sheet\n**Date:** ${dateStr}\n**Class:** \n\n| Student Name | Status (Present / Absent / Late) | Remarks |\n|---|---|---|\n| Student 1 | Present | |\n| Student 2 | Absent | Excused |\n\n**Total Present:** \n**Total Absent:** `;
    case "assessments":
      return `## Assessment & Marks Sheet\n**Date:** ${dateStr}\n**Subject:** \n**Quiz / Test Name:** \n**Max Score:** \n\n| Student Name | Score | Notes |\n|---|---|---|\n| Student 1 | | |\n| Student 2 | | |\n\n**Class Mean:** `;
    case "facilities":
      return `## Laboratory & Facility Report\n**Date:** ${dateStr}\n**Facility / Room:** \n**Severity:** Low / Medium / High\n\n### Observation / Incident:\n- \n\n### Actions Taken / Requested:\n- `;
    default:
      return `## Teacher Report\n**Date:** ${dateStr}\n**Teacher:** \n\n### Summary:\n\n### Detailed Observations:\n- \n\n### Recommendations / Follow-up:\n- `;
  }
}
