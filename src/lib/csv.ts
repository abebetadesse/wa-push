export function parseCsvRecords(source: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      record.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field.trim());
      if (record.some((cell) => cell.length > 0)) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  record.push(field.trim());
  if (record.some((cell) => cell.length > 0)) records.push(record);
  return records;
}
