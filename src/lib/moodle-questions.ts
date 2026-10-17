import { XMLParser, XMLValidator } from "fast-xml-parser";

export type QuestionImportFormat = "moodle-xml" | "gift" | "aiken" | "blackboard" | "webct";
export type ImportedQuestion = {
  prompt: string;
  options: string[];
  correctOption: number;
  points: number;
};

export class QuestionImportError extends Error {}

const MAX_IMPORTED_QUESTIONS = 200;

export function parseQuestionImport(
  source: string,
  format: QuestionImportFormat,
): { questions: ImportedQuestion[]; skipped: number } {
  if (!source.trim()) throw new QuestionImportError("The selected question file is empty.");

  const parsed = format === "moodle-xml"
    ? parseMoodleXml(source)
    : format === "gift"
      ? parseGift(source)
      : format === "aiken"
        ? parseAiken(source)
        : format === "blackboard"
          ? parseBlackboard(source)
          : parseWebct(source);

  if (parsed.questions.length === 0) {
    const skipped = parsed.skipped
      ? `${parsed.skipped} unsupported or invalid question${parsed.skipped === 1 ? " was" : "s were"} detected.`
      : "No recognizable question entries were found.";
    throw new QuestionImportError(
      `No supported multiple-choice questions were found. ${skipped} Use single-answer multiple-choice questions and check the selected format.`,
    );
  }
  if (parsed.questions.length > MAX_IMPORTED_QUESTIONS) {
    throw new QuestionImportError(`A file can contain at most ${MAX_IMPORTED_QUESTIONS} supported questions.`);
  }
  return parsed;
}

function parseMoodleXml(source: string) {
  const validation = XMLValidator.validate(source);
  if (validation !== true) throw new QuestionImportError("The Moodle XML file is not valid XML.");
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
  }).parse(source) as Record<string, unknown>;
  const quiz = asRecord(document.quiz);
  const entries = asArray(quiz.question);
  if (!entries.length) throw new QuestionImportError("The Moodle XML file contains no questions.");

  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const question = asRecord(entry);
    const type = String(question["@_type"] ?? "");
    if (type === "category" || type === "description") continue;
    if (type !== "multichoice") {
      skipped += 1;
      continue;
    }

    const single = readText(question.single).toLowerCase();
    const answers = asArray(question.answer).map((answer) => asRecord(answer));
    const options = answers.map((answer) => readText(answer.text));
    const correctAnswers = answers
      .map((answer, index) => ({ index, fraction: Number(answer["@_fraction"]) }))
      .filter(({ fraction }) => fraction === 100);
    const pointsValue = Number(readText(question.defaultgrade) || "1");
    const prompt = readText(asRecord(question.questiontext).text);
    if (
      single !== "true" ||
      !prompt ||
      prompt.length > 2000 ||
      options.length < 2 ||
      options.length > 20 ||
      options.some((option) => !option || option.length > 2000) ||
      correctAnswers.length !== 1 ||
      !Number.isInteger(pointsValue) ||
      pointsValue < 1 ||
      pointsValue > 100
    ) {
      skipped += 1;
      continue;
    }
    questions.push({
      prompt,
      options,
      correctOption: correctAnswers[0].index,
      points: pointsValue,
    });
  }
  return { questions, skipped };
}

function parseGift(source: string) {
  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  let cursor = 0;
  let parsedBlocks = 0;
  while (cursor < source.length) {
    const open = findUnescaped(source, "{", cursor);
    if (open === -1) break;
    const close = findUnescaped(source, "}", open + 1);
    if (close === -1) throw new QuestionImportError("The GIFT file has an answer block without a closing brace.");

    const prompt = cleanGiftText(source.slice(cursor, open))
      .replace(/^\s*::[^:\r\n]*::/, "")
      .replace(/^\s*\/\/.*(?:\r?\n|$)/gm, "")
      .trim();
    const body = source.slice(open + 1, close);
    const choices: { text: string; correct: boolean }[] = [];
    const answerPattern = /([=~])(?:%([+-]?\d+(?:\.\d+)?)%)?((?:\\.|[^=~])*)/g;
    for (const match of body.matchAll(answerPattern)) {
      const marker = match[1];
      const weight = match[2] === undefined ? null : Number(match[2]);
      const text = cleanGiftText(match[3]).replace(/#[\s\S]*$/, "").trim();
      if (text) choices.push({ text, correct: marker === "=" || weight === 100 });
    }
    parsedBlocks += 1;
    const correct = choices.filter((choice) => choice.correct);
    if (
      prompt &&
      prompt.length <= 2000 &&
      choices.length >= 2 &&
      choices.length <= 20 &&
      choices.every((choice) => choice.text.length <= 2000) &&
      correct.length === 1
    ) {
      questions.push({
        prompt,
        options: choices.map((choice) => choice.text),
        correctOption: choices.indexOf(correct[0]),
        points: 1,
      });
    } else {
      skipped += 1;
    }
    cursor = close + 1;
  }
  if (!parsedBlocks && source.trim()) skipped = 1;
  return { questions, skipped };
}

function parseAiken(source: string) {
  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  const lines = source.replace(/\r/g, "").split("\n");
  let block: string[] = [];
  let ignoreExplanation = false;
  const finish = () => {
    if (!block.some((line) => line.trim())) return;
    const answerIndex = block.findIndex((line) => /^\s*ANSWER\s*:\s*[A-Z]\s*$/i.test(line));
    if (answerIndex < 0) {
      if (!block.some((line) => /^\s*(?:EXPLANATION|RATIONALE)\s*:/i.test(line))) skipped += 1;
      block = [];
      return;
    }
    const optionStart = block.findIndex((line) => /^\s*[A-Z][.)]\s*/i.test(line));
    const prompt = block.slice(0, optionStart).join(" ").trim();
    const options = block.slice(optionStart, answerIndex).map((line) => line.match(/^\s*[A-Z][.)]\s*(.+?)\s*$/i)?.[1] ?? "");
    const answer = block[answerIndex].match(/ANSWER\s*:\s*([A-Z])/i)?.[1]?.toUpperCase() ?? "";
    const correctOption = answer.charCodeAt(0) - 65;
    if (prompt && prompt.length <= 2000 && options.length >= 2 && options.length <= 20 && options.every((option) => option && option.length <= 2000) && correctOption >= 0 && correctOption < options.length) {
      questions.push({ prompt, options, correctOption, points: 1 });
    } else {
      skipped += 1;
    }
    block = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      finish();
      ignoreExplanation = false;
      continue;
    }
    if (ignoreExplanation) continue;
    if (!block.length && /^\s*(?:EXPLANATION|RATIONALE)\s*:/i.test(line)) {
      ignoreExplanation = true;
      continue;
    }
    block.push(line);
    if (/^\s*ANSWER\s*:/i.test(line)) {
      finish();
    }
  }
  finish();
  return { questions, skipped };
}

function parseBlackboard(source: string) {
  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  const blocks = source.replace(/\r/g, "").split(/\n\s*\n/);
  for (const rawBlock of blocks) {
    const lines = rawBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const typeIndex = lines.findIndex((line) => /^(?:MC|MA|TF|ESS|FIB|NUM|MATCHING)$/i.test(line));
    const type = typeIndex >= 0 ? lines[typeIndex].toUpperCase() : "MC";
    if (type !== "MC") {
      skipped += 1;
      continue;
    }
    const content = lines.filter((_, index) => index !== typeIndex);
    const prompt = content.find((line) => !/^(?:ANSWER|ANS)\s*:/i.test(line) && !/^(?:\*?\s*)?[A-Z][.)]\s*/i.test(line)) ?? "";
    const options = content
      .map((line) => {
        const match = line.match(/^(\*?)\s*[A-Z][.)]\s*(.+)$/i);
        return match ? { text: match[2].trim(), correct: Boolean(match[1]) } : null;
      })
      .filter((option): option is { text: string; correct: boolean } => option !== null);
    const answerLine = content.find((line) => /^(?:ANSWER|ANS)\s*:/i.test(line));
    const answerLetter = answerLine?.match(/:\s*([A-Z])/i)?.[1]?.toUpperCase();
    const markedCorrectIndexes = options.flatMap((option, index) => option.correct ? [index] : []);
    const correctIndex = answerLetter
      ? answerLetter.charCodeAt(0) - 65
      : markedCorrectIndexes[0] ?? -1;
    const conflictingMarks = markedCorrectIndexes.length > 1 ||
      (answerLetter && markedCorrectIndexes.length === 1 && markedCorrectIndexes[0] !== correctIndex);
    if (!conflictingMarks && prompt && prompt.length <= 2000 && options.length >= 2 && options.length <= 20 && options.every((option) => option.text.length <= 2000) && correctIndex >= 0 && correctIndex < options.length) {
      questions.push({ prompt, options: options.map((option) => option.text), correctOption: correctIndex, points: 1 });
    } else {
      skipped += 1;
    }
  }
  return { questions, skipped };
}

function parseWebct(source: string) {
  if (source.includes("{") && source.includes("}")) return parseGift(source);

  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  const blocks = source.replace(/\r/g, "").split(/\n\s*\n/);
  for (const rawBlock of blocks) {
    const lines = rawBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const prompt = lines.find((line) => !/^(?:ANSWER|ANS)\s*:/i.test(line) && !/^(?:\*?\s*)?(?:[A-Z]|\d+)[.)]\s*/i.test(line)) ?? "";
    const options = lines
      .map((line) => line.match(/^(\*?)\s*(?:[A-Z]|\d+)[.)]\s*(.+)$/i))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => ({ text: match[2].trim(), correct: Boolean(match[1]) }));
    const answerLine = lines.find((line) => /^(?:ANSWER|ANS)\s*:/i.test(line));
    const answerLabel = answerLine?.match(/:\s*([A-Z]|\d+)/i)?.[1]?.toUpperCase();
    const markedCorrectIndexes = options.flatMap((option, index) => option.correct ? [index] : []);
    const correctIndex = answerLabel
      ? /^\d+$/.test(answerLabel)
        ? Number(answerLabel) - 1
        : answerLabel.charCodeAt(0) - 65
      : markedCorrectIndexes[0] ?? -1;
    const conflictingMarks = markedCorrectIndexes.length > 1 ||
      (answerLabel && markedCorrectIndexes.length === 1 && markedCorrectIndexes[0] !== correctIndex);
    if (!conflictingMarks && prompt && prompt.length <= 2000 && options.length >= 2 && options.length <= 20 && options.every((option) => option.text.length <= 2000) && correctIndex >= 0 && correctIndex < options.length) {
      questions.push({ prompt, options: options.map((option) => option.text), correctOption: correctIndex, points: 1 });
    } else {
      skipped += 1;
    }
  }
  return { questions, skipped };
}

function findUnescaped(source: string, character: string, from: number) {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === character && (index === 0 || source[index - 1] !== "\\")) return index;
  }
  return -1;
}

function cleanGiftText(value: string) {
  return value
    .replace(/\\([\\{}~=#])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function readText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
  const record = asRecord(value);
  if ("#text" in record) return readText(record["#text"]);
  if ("text" in record) return readText(record.text);
  return "";
}
