import "server-only";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classSchedules, learningResources } from "@/db/schema";
import { resourceStoragePath } from "@/lib/learning-resources";

export type GeneratedLessonPlan = {
  tempId: string;
  unitTopic: string;
  title: string;
  durationMinutes: number;
  scheduledDate?: string;
  scheduleId?: string;
  overview: string;
  objectives: string;
  materials: string;
  prerequisites: string;
  procedures: string;
  differentiation: string;
  assessment: string;
  homework: string;
  notes: string;
};

export type ExtractedUnit = {
  unitTitle: string;
  topics: string[];
  summary?: string;
};

/**
 * Extracts plain text from an uploaded learning resource or file path.
 */
export async function extractResourceText(schoolId: string, resourceId: string): Promise<{ fileName: string; text: string }> {
  const [resource] = await db
    .select({
      fileName: learningResources.fileName,
      storageKey: learningResources.storageKey,
      title: learningResources.title,
      description: learningResources.description,
    })
    .from(learningResources)
    .where(and(eq(learningResources.id, resourceId), eq(learningResources.schoolId, schoolId)))
    .limit(1);

  if (!resource) {
    throw new Error("Learning resource not found in this school.");
  }

  const filePath = resourceStoragePath(schoolId, resource.storageKey);
  if (!existsSync(filePath)) {
    return {
      fileName: resource.fileName,
      text: `${resource.title}\n${resource.description ?? ""}`,
    };
  }

  const ext = resource.fileName.toLowerCase();
  try {
    const rawBuffer = await readFile(filePath);

    // Text / markdown / html / json / csv
    if (
      ext.endsWith(".txt") ||
      ext.endsWith(".md") ||
      ext.endsWith(".markdown") ||
      ext.endsWith(".csv") ||
      ext.endsWith(".json") ||
      ext.endsWith(".xml") ||
      ext.endsWith(".html") ||
      ext.endsWith(".htm")
    ) {
      return {
        fileName: resource.fileName,
        text: rawBuffer.toString("utf8"),
      };
    }

    // Basic string extraction from PDF / Doc binary without heavy native dependencies
    const rawString = rawBuffer.toString("latin1");
    // Extract readable ascii text blocks
    const printableMatches = rawString.match(/[A-Za-z0-9\s.,!?:;'"()\-_/]{4,}/g);
    if (printableMatches && printableMatches.length > 0) {
      const filtered = printableMatches
        .filter((chunk) => !chunk.startsWith("/Font") && !chunk.startsWith("/Type") && !chunk.includes("stream"))
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 50000);

      if (filtered.length > 50) {
        return {
          fileName: resource.fileName,
          text: `${resource.title}\n\n${filtered}`,
        };
      }
    }

    return {
      fileName: resource.fileName,
      text: `${resource.title}\n\n${resource.description ?? ""}`,
    };
  } catch {
    return {
      fileName: resource.fileName,
      text: `${resource.title}\n\n${resource.description ?? ""}`,
    };
  }
}

/**
 * Parses raw textbook or syllabus text into structured units and sequential topics.
 */
export function parseTextbookOutline(rawText: string, fallbackSubjectName = "Subject"): ExtractedUnit[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const units: ExtractedUnit[] = [];
  let currentUnit: ExtractedUnit | null = null;

  const unitRegex = /^(?:unit|chapter|module|section|part|theme)\s*([0-9ivxlcdm]+)?[:.-]?\s*(.*)/i;
  const topicRegex = /^(?:lesson|topic|session|\d+\.\d+|\*|-|•)\s*[:.-]?\s*(.*)/i;

  for (const line of lines) {
    const unitMatch = line.match(unitRegex);
    if (unitMatch && line.length < 120) {
      if (currentUnit && currentUnit.topics.length > 0) {
        units.push(currentUnit);
      }
      const unitNum = unitMatch[1] ? `Unit ${unitMatch[1]}: ` : `Unit ${units.length + 1}: `;
      const title = unitMatch[2]?.trim() || line;
      currentUnit = {
        unitTitle: title.startsWith("Unit") ? title : `${unitNum}${title}`,
        topics: [],
      };
      continue;
    }

    if (!currentUnit) {
      currentUnit = {
        unitTitle: `Unit 1: Introduction to ${fallbackSubjectName}`,
        topics: [],
      };
    }

    const topicMatch = line.match(topicRegex);
    if (topicMatch) {
      const topicText = topicMatch[1].trim();
      if (topicText.length >= 3 && topicText.length <= 150) {
        currentUnit.topics.push(topicText);
        continue;
      }
    }

    // If it's a short descriptive heading or bullet point
    if (line.length >= 4 && line.length <= 100 && !line.includes("http") && !line.includes("Page ")) {
      currentUnit.topics.push(line);
    }
  }

  if (currentUnit && currentUnit.topics.length > 0) {
    units.push(currentUnit);
  }

  // If no structured units were detected, chunk the text into logical thematic units
  if (units.length === 0 || units.every((u) => u.topics.length === 0)) {
    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    const chunkCount = Math.max(1, Math.min(5, Math.ceil(paragraphs.length / 3)));
    for (let i = 0; i < chunkCount; i++) {
      const chunkParagraphs = paragraphs.slice(i * 3, (i + 1) * 3);
      const unitTitle = `Unit ${i + 1}: ${fallbackSubjectName} Core Concepts (Part ${i + 1})`;
      const topics = chunkParagraphs.map((p, idx) => {
        const firstSentence = p.split(/[.?!]/)[0]?.trim();
        return firstSentence && firstSentence.length < 90
          ? firstSentence
          : `Core Topic ${idx + 1}: Foundations and Practical Applications`;
      });

      units.push({
        unitTitle,
        topics: topics.length > 0 ? topics : [`Overview and Principles of Unit ${i + 1}`, `Applied Skills and Problem Solving`],
      });
    }
  }

  // Ensure each unit has at least 2 structured topics
  return units.map((u) => {
    if (u.topics.length === 0) {
      return {
        ...u,
        topics: [
          `Introduction to ${u.unitTitle}`,
          `Core Principles and Exploration`,
          `Practical Application and Case Study`,
          `Review, Formative Assessment and Synthesis`,
        ],
      };
    }
    return u;
  });
}

/**
 * Calculates dates based on weekly class schedules (timetable).
 */
export function calculateScheduleDates(
  slots: { id: string; dayOfWeek: string; startTime: string; endTime: string }[],
  startDateStr: string,
  totalLessons: number,
): { date: string; scheduleId: string; durationMinutes: number }[] {
  if (slots.length === 0) {
    const dates: { date: string; scheduleId: string; durationMinutes: number }[] = [];
    const current = new Date(`${startDateStr}T09:00:00.000Z`);
    while (dates.length < totalLessons) {
      // Skip weekends (0 is Sunday, 6 is Saturday)
      const day = current.getUTCDay();
      if (day !== 0 && day !== 6) {
        dates.push({
          date: current.toISOString().slice(0, 10),
          scheduleId: "",
          durationMinutes: 45,
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const dates: { date: string; scheduleId: string; durationMinutes: number }[] = [];
  const current = new Date(`${startDateStr}T00:00:00.000Z`);
  let guard = 0;

  while (dates.length < totalLessons && guard < 365) {
    guard++;
    const currentDay = current.getUTCDay();

    // Check which timetable slot matches today's day of week
    for (const slot of slots) {
      if (dayMap[slot.dayOfWeek.toLowerCase()] === currentDay) {
        const [sh, sm] = slot.startTime.split(":").map(Number);
        const [eh, em] = slot.endTime.split(":").map(Number);
        const duration = (eh * 60 + em) - (sh * 60 + sm);

        dates.push({
          date: current.toISOString().slice(0, 10),
          scheduleId: slot.id,
          durationMinutes: duration > 0 ? duration : 45,
        });

        if (dates.length >= totalLessons) break;
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Generates an end-to-end pedagogical lesson plan for a specific unit and topic.
 */
export function generateSingleLessonPlan(params: {
  tempId: string;
  unitTitle: string;
  topicTitle: string;
  lessonIndexInUnit: number;
  totalLessonsInUnit: number;
  subjectName: string;
  gradeName: string;
  durationMinutes: number;
  scheduledDate?: string;
  scheduleId?: string;
  resourceTitle?: string;
}): GeneratedLessonPlan {
  const {
    tempId,
    unitTitle,
    topicTitle,
    lessonIndexInUnit,
    totalLessonsInUnit,
    subjectName,
    gradeName,
    durationMinutes,
    scheduledDate,
    scheduleId,
    resourceTitle,
  } = params;

  const isFirst = lessonIndexInUnit === 1;
  const isFinal = lessonIndexInUnit === totalLessonsInUnit;

  const starterTime = Math.max(5, Math.round(durationMinutes * 0.2));
  const mainTime = Math.max(15, Math.round(durationMinutes * 0.55));
  const plenaryTime = Math.max(5, durationMinutes - starterTime - mainTime);

  const title = `${unitTitle} — Lesson ${lessonIndexInUnit}: ${topicTitle}`;

  const overview = `In this lesson for ${gradeName} ${subjectName}, students explore "${topicTitle}" within the framework of ${unitTitle}. ${
    isFirst
      ? "This introductory lesson establishes foundational definitions, activates prior knowledge, and sets key inquiry questions."
      : isFinal
      ? "This culminating lesson synthesizes concepts learned throughout the unit, addresses misconceptions, and engages students in practical problem-solving."
      : "Students analyze core mechanisms, engage in structured practice, and apply learning to real-world scenarios."
  }${resourceTitle ? ` Aligned with learning resource: ${resourceTitle}.` : ""}`;

  const objectives = `By the end of this lesson, students will be able to:
1. Define and explain the essential principles of ${topicTitle} using accurate academic terminology.
2. Demonstrate conceptual understanding through guided examples and collaborative problem solving.
3. Apply their knowledge to analyze scenarios and solve practice exercises with at least 80% accuracy.
${isFinal ? "4. Synthesize unit concepts and formulate conclusions justifying their reasoning." : "4. Evaluate their own learning through an individual exit ticket reflection."}`;

  const materials = `• Textbook / Course Reference: ${resourceTitle ?? `${gradeName} ${subjectName} Curriculum Guide`}
• Whiteboard, markers, and digital presentation slides
• Student activity handout: "${topicTitle} Guided Inquiry Sheet"
• Visual diagrams and illustrative models relevant to ${unitTitle}
• Formative exit tickets and practice cards`;

  const prerequisites = `Students should be familiar with basic foundational concepts from ${
    isFirst ? "earlier grade levels or preceding introductory topics" : `preceding lessons in ${unitTitle}`
  }, including standard terminology, unit conversions, and analytical reading skills.`;

  const procedures = `Phase 1: Starter & Engagement (${starterTime} mins)
• Hook: Present a real-world scenario or thought-provoking prompt: "How does ${topicTitle} manifest in everyday life?"
• Prior Knowledge Retrieval: Conduct a quick 3-minute think-pair-share reviewing relevant terminology.
• Learning Objectives: Display and discuss the lesson goals and success criteria.

Phase 2: Main Direct Instruction & Guided Practice (${mainTime} mins)
• Explicit Modeling (10 mins): Introduce key concepts and formulas/rules for ${topicTitle}. Walk through two worked examples on the board, thinking aloud.
• Collaborative Activity (10 mins): Students work in pairs on targeted inquiry questions from the text, discussing evidence and strategies. Teacher circulates to offer scaffolding and note common pitfalls.
• Independent Practice (10 mins): Students complete differentiated exercises to demonstrate individual competence.

Phase 3: Plenary & Formative Wrap-Up (${plenaryTime} mins)
• Summary Discussion: Call on 2–3 pairs to share solutions and explain their methodology.
• Exit Ticket: Students write 1 thing they mastered and 1 question they still have about ${topicTitle}.
• Preview: Briefly introduce how today's topic links directly to the upcoming lesson.`;

  const differentiation = `• Support for Struggling Learners: Provide graphic organizers, structured sentence starters, formula sheets, and peer pairing with guided check-ins.
• Challenge for Advanced Learners: Assign higher-order synthesis tasks, multi-step word problems, and ask them to hypothesize real-world edge cases.
• Multilingual Support: Clarify key vocabulary on a dedicated word-wall with visual representations.`;

  const assessment = `• Formative Check: Active observation during guided practice with targeted feedback on common misconceptions.
• Quick Questioning: Thumbs up / thumbs down checks and cold-calling for comprehension checks.
• Exit Ticket Prompt: "Explain in two sentences how ${topicTitle} functions and why it matters."
• Homework Alignment: Exercises 1–5 from unit review section to be checked at the start of next class.`;

  const homework = `1. Complete textbook practice questions 1–6 on ${topicTitle} (approx. 20 minutes).
2. Write a 3-sentence summary in your study journal connecting today's lesson to ${unitTitle}.
3. Preview the next section in the textbook.`;

  const notes = `• Check student mastery of prerequisites before moving to Phase 2.
• Emphasize safety and respectful collaboration during peer activities.
• Archived in school management system for iterative refinement in future terms.`;

  return {
    tempId,
    unitTopic: unitTitle,
    title,
    durationMinutes,
    scheduledDate,
    scheduleId,
    overview,
    objectives,
    materials,
    prerequisites,
    procedures,
    differentiation,
    assessment,
    homework,
    notes,
  };
}

/**
 * Generates a complete curriculum batch of lesson plans for a subject and classroom.
 */
export async function generateCurriculumLessonPlans(params: {
  schoolId: string;
  academicYearId: string;
  gradeLevelId: string;
  subjectId: string;
  classroomId?: string;
  teacherId?: string;
  resourceId?: string;
  customText?: string;
  startDate?: string;
  subjectName: string;
  gradeName: string;
}): Promise<GeneratedLessonPlan[]> {
  const {
    schoolId,
    classroomId,
    subjectId,
    resourceId,
    customText,
    startDate = new Date().toISOString().slice(0, 10),
    subjectName,
    gradeName,
  } = params;

  // 1. Fetch text content from resource if provided
  let sourceText = customText?.trim() ?? "";
  let resourceTitle = "";

  if (resourceId) {
    try {
      const extracted = await extractResourceText(schoolId, resourceId);
      sourceText = `${extracted.text}\n\n${sourceText}`.trim();
      resourceTitle = extracted.fileName;
    } catch {
      // Keep custom text fallback
    }
  }

  if (!sourceText) {
    sourceText = `Unit 1: Fundamentals and Foundations of ${subjectName}
Lesson 1: Introduction and Core Principles
Lesson 2: Key Concepts, Models and Terminology
Lesson 3: Practical Analysis and Application
Unit 2: Advanced Topics and In-Depth Study
Lesson 1: Complex Interactions and Case Studies
Lesson 2: Problem Solving and Evidence Evaluation
Lesson 3: Unit Synthesis, Review and Assessment`;
  }

  // 2. Parse units and topics
  const units = parseTextbookOutline(sourceText, subjectName);

  // Count total lessons
  const totalLessons = units.reduce((acc, u) => acc + u.topics.length, 0);

  // 3. Query class timetable schedules if classroomId is provided
  let timetableSlots: { id: string; dayOfWeek: string; startTime: string; endTime: string }[] = [];
  if (classroomId) {
    timetableSlots = await db
      .select({
        id: classSchedules.id,
        dayOfWeek: classSchedules.dayOfWeek,
        startTime: classSchedules.startTime,
        endTime: classSchedules.endTime,
      })
      .from(classSchedules)
      .where(and(eq(classSchedules.schoolId, schoolId), eq(classSchedules.classroomId, classroomId), eq(classSchedules.subjectId, subjectId)))
      .orderBy(classSchedules.dayOfWeek, classSchedules.startTime);
  }

  const scheduleDates = calculateScheduleDates(timetableSlots, startDate, totalLessons);

  // 4. Generate individual lesson plans
  const plans: GeneratedLessonPlan[] = [];
  let globalIndex = 0;

  for (const unit of units) {
    for (let i = 0; i < unit.topics.length; i++) {
      const topic = unit.topics[i];
      const slot = scheduleDates[globalIndex] ?? {
        date: startDate,
        scheduleId: undefined,
        durationMinutes: 45,
      };

      const plan = generateSingleLessonPlan({
        tempId: `gen-${Date.now()}-${globalIndex}-${Math.random().toString(36).slice(2, 7)}`,
        unitTitle: unit.unitTitle,
        topicTitle: topic,
        lessonIndexInUnit: i + 1,
        totalLessonsInUnit: unit.topics.length,
        subjectName,
        gradeName,
        durationMinutes: slot.durationMinutes || 45,
        scheduledDate: slot.date,
        scheduleId: slot.scheduleId,
        resourceTitle,
      });

      plans.push(plan);
      globalIndex++;
    }
  }

  return plans;
}
