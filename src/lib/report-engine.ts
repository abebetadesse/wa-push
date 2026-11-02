// Groups, filters and aggregates an analytics dataset for one report. Pure functions: the report
// builder runs them in the browser on every change, and the dashboard reuses them for pinned reports.
import type { ReportConfig } from "@/db/schema";
import { AGGREGATIONS, type AnalyticsColumn, type AnalyticsDataset } from "@/lib/analytics-shared";

export type ReportMeasure = { key: string; label: string; column: AnalyticsColumn | null; agg: string };

export type ReportRow = {
  key: string;
  labels: string[];
  /** values[seriesIndex][measureIndex] */
  values: (number | null)[][];
  total: (number | null)[];
};

export type ReportResult = {
  rowColumns: AnalyticsColumn[];
  seriesColumn: AnalyticsColumn | null;
  measures: ReportMeasure[];
  series: string[];
  rows: ReportRow[];
  grand: (number | null)[];
  matched: number;
  hiddenRows: number;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function aggregate(values: number[], agg: string, rowCount: number, distinct: Set<string>): number | null {
  if (agg === "count") return rowCount;
  if (agg === "distinct") return distinct.size;
  if (values.length === 0) return null;
  if (agg === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (agg === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (agg === "min") return Math.min(...values);
  if (agg === "max") return Math.max(...values);
  if (agg === "median") {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return null;
}

function matches(cell: string | number | null, op: string, raw: string) {
  const text = cell === null || cell === undefined ? "" : String(cell);
  const number = Number(raw);
  switch (op) {
    case "eq": return text.toLowerCase() === raw.toLowerCase();
    case "ne": return text.toLowerCase() !== raw.toLowerCase();
    case "in": return raw.split(";").map((part) => part.trim().toLowerCase()).includes(text.toLowerCase());
    case "contains": return text.toLowerCase().includes(raw.toLowerCase());
    case "gt": return cell !== null && Number(cell) > number;
    case "gte": return cell !== null && Number(cell) >= number;
    case "lt": return cell !== null && Number(cell) < number;
    case "lte": return cell !== null && Number(cell) <= number;
    case "empty": return text === "" || text === "(not set)";
    case "notempty": return text !== "" && text !== "(not set)";
    default: return true;
  }
}

export function measureLabel(column: AnalyticsColumn | null, agg: string) {
  const aggLabel = AGGREGATIONS.find((entry) => entry.key === agg)?.label ?? agg;
  if (agg === "count" || !column) return "Count";
  return `${aggLabel} of ${column.label}`;
}

export function computeReport(dataset: AnalyticsDataset, config: ReportConfig): ReportResult {
  const index = new Map(dataset.columns.map((column, position) => [column.key, position]));
  const column = (key: string | null | undefined) => (key && index.has(key) ? dataset.columns[index.get(key)!] : null);
  const rowColumns = config.rows.map((key) => column(key)).filter((entry): entry is AnalyticsColumn => Boolean(entry));
  const seriesColumn = column(config.series);
  const measures: ReportMeasure[] = (config.measures.length ? config.measures : [{ column: "", agg: "count" }]).map((measure, position) => {
    const source = column(measure.column);
    const agg = source || measure.agg === "count" ? measure.agg : "count";
    return { key: `m${position}`, label: measureLabel(source, agg), column: source, agg };
  });

  const filters = config.filters.filter((filter) => index.has(filter.column));
  const rows = dataset.rows.filter((row) => filters.every((filter) => matches(row[index.get(filter.column)!], filter.op, filter.value)));

  const seriesSet = new Set<string>();
  type Bucket = { labels: string[]; series: Map<string, { count: number; values: number[][]; distinct: Set<string>[] }> };
  const buckets = new Map<string, Bucket>();
  const totals = { count: 0, values: measures.map(() => [] as number[]), distinct: measures.map(() => new Set<string>()) };
  const rowTotals = new Map<string, { count: number; values: number[][]; distinct: Set<string>[] }>();

  for (const row of rows) {
    const labels = rowColumns.map((entry) => String(row[index.get(entry.key)!] ?? "(not set)"));
    const rowKey = labels.join(" ▸ ") || "All";
    const seriesKey = seriesColumn ? String(row[index.get(seriesColumn.key)!] ?? "(not set)") : "";
    seriesSet.add(seriesKey);
    const bucket = buckets.get(rowKey) ?? { labels: labels.length ? labels : ["All"], series: new Map() };
    buckets.set(rowKey, bucket);
    const cell = bucket.series.get(seriesKey) ?? { count: 0, values: measures.map(() => []), distinct: measures.map(() => new Set<string>()) };
    bucket.series.set(seriesKey, cell);
    const rowTotal = rowTotals.get(rowKey) ?? { count: 0, values: measures.map(() => []), distinct: measures.map(() => new Set<string>()) };
    rowTotals.set(rowKey, rowTotal);
    cell.count += 1;
    rowTotal.count += 1;
    totals.count += 1;
    measures.forEach((measure, position) => {
      if (!measure.column) return;
      const value = row[index.get(measure.column.key)!];
      if (value === null || value === undefined || value === "") return;
      for (const target of [cell, rowTotal, totals]) target.distinct[position].add(String(value));
      const number = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(number)) for (const target of [cell, rowTotal, totals]) target.values[position].push(number);
    });
  }

  const series = [...seriesSet].sort(collator.compare);
  let result: ReportRow[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    labels: bucket.labels,
    values: series.map((seriesKey) => {
      const cell = bucket.series.get(seriesKey);
      return measures.map((measure, position) => cell ? aggregate(cell.values[position], measure.agg, cell.count, cell.distinct[position]) : null);
    }),
    total: measures.map((measure, position) => {
      const total = rowTotals.get(key)!;
      return aggregate(total.values[position], measure.agg, total.count, total.distinct[position]);
    }),
  }));

  // Like most BI tools, hide groups with no value at all (e.g. schools that have not sent this year's census).
  result = result.filter((row) => row.total.some((value) => value !== null));

  if (config.sort === "value_desc") result.sort((a, b) => (b.total[0] ?? -Infinity) - (a.total[0] ?? -Infinity));
  else if (config.sort === "value_asc") result.sort((a, b) => (a.total[0] ?? Infinity) - (b.total[0] ?? Infinity));
  else result.sort((a, b) => collator.compare(a.key, b.key));
  const before = result.length;
  if (config.limit > 0) result = result.slice(0, config.limit);

  return {
    rowColumns,
    seriesColumn,
    measures,
    series,
    rows: result,
    grand: measures.map((measure, position) => aggregate(totals.values[position], measure.agg, totals.count, totals.distinct[position])),
    matched: rows.length,
    hiddenRows: before - result.length,
  };
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function emptyConfig(source = "schools"): ReportConfig {
  return {
    source,
    visual: "column",
    rows: [],
    series: null,
    measures: [{ column: "", agg: "count" }],
    filters: [],
    scope: { unitId: null, schoolId: null },
    period: "",
    sort: "label",
    limit: 0,
    showPercent: false,
  };
}
