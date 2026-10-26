import { NextResponse } from "next/server";
import { getSession } from "@/lib/permissions";
import { transcribeReportPhoto, type ReportSection } from "@/lib/transcription";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    }

    let base64Data = "";
    let mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
    let selectedSection: ReportSection | undefined;
    let contextHint: string | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      base64Data = body.imageBase64 || "";
      if (body.mediaType) mediaType = body.mediaType;
      selectedSection = body.section;
      contextHint = body.contextHint;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("photo");
      selectedSection = (formData.get("section") as ReportSection) || undefined;
      contextHint = (formData.get("contextHint") as string) || undefined;

      if (file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        base64Data = buffer.toString("base64");
        if (file.type === "image/png") mediaType = "image/png";
        else if (file.type === "image/webp") mediaType = "image/webp";
        else mediaType = "image/jpeg";
      }
    }

    // Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
    if (base64Data.includes(",")) {
      const parts = base64Data.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (mime === "image/png") mediaType = "image/png";
        else if (mime === "image/webp") mediaType = "image/webp";
        else mediaType = "image/jpeg";
      }
      base64Data = parts[1];
    }

    if (!base64Data || base64Data.length < 50) {
      return NextResponse.json({ error: "Please provide a valid photo to transcribe." }, { status: 400 });
    }

    const result = await transcribeReportPhoto({
      base64Data,
      mediaType,
      selectedSection,
      contextHint,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[transcribe API] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process photo transcription.",
      },
      { status: 500 },
    );
  }
}
