// The analytics model shared by the server (which builds datasets) and the report builder (which
// groups, filters and charts them in the browser, so changing a report needs no round trip).

export const ANALYTICS_SOURCES = [
  { key: "schools", label: "Schools", description: "One row per school: its place in the hierarchy and every school data field (census, facilities, staffing)." },
  { key: "students", label: "Students", description: "One row per student: sex, age, grade, class and student data fields." },
  { key: "teachers", label: "Teachers", description: "One row per teacher: sex, status and teacher data fields." },
  { key: "staff", label: "Staff", description: "One row per staff member and staff data fields." },
  { key: "attendance", label: "Attendance", description: "Attendance records by school, class, sex, month and status." },
  { key: "results", label: "Assessment results", description: "Marked results by subject, class, sex and score band." },
] as const;
export type AnalyticsSource = (typeof ANALYTICS_SOURCES)[number]["key"];

export type AnalyticsColumn = { key: string; label: string; kind: "category" | "number"; group: string };

export type AnalyticsDataset = {
  source: AnalyticsSource;
  columns: AnalyticsColumn[];
  rows: (string | number | null)[][];
  truncated: boolean;
  period: string;
  schoolCount: number;
};

export const AGGREGATIONS = [
  { key: "count", label: "Count of rows" },
  { key: "sum", label: "Sum" },
  { key: "avg", label: "Average" },
  { key: "min", label: "Minimum" },
  { key: "max", label: "Maximum" },
  { key: "median", label: "Median" },
  { key: "distinct", label: "Distinct count" },
] as const;
export type Aggregation = (typeof AGGREGATIONS)[number]["key"];

export const VISUALS = [
  { key: "table", label: "Table" },
  { key: "matrix", label: "Matrix (pivot)" },
  { key: "column", label: "Column chart" },
  { key: "stacked", label: "Stacked columns" },
  { key: "stacked100", label: "100% stacked columns" },
  { key: "bar", label: "Bar chart" },
  { key: "line", label: "Line chart" },
  { key: "area", label: "Area chart" },
  { key: "pie", label: "Pie chart" },
  { key: "donut", label: "Donut chart" },
  { key: "kpi", label: "KPI cards" },
  { key: "heatmap", label: "Heat map" },
] as const;
export type Visual = (typeof VISUALS)[number]["key"];

export const FILTER_OPS = [
  { key: "eq", label: "is" },
  { key: "ne", label: "is not" },
  { key: "in", label: "is one of (a; b)" },
  { key: "contains", label: "contains" },
  { key: "gt", label: ">" },
  { key: "gte", label: "≥" },
  { key: "lt", label: "<" },
  { key: "lte", label: "≤" },
  { key: "empty", label: "is empty" },
  { key: "notempty", label: "is not empty" },
] as const;

export function isSource(value: string): value is AnalyticsSource {
  return ANALYTICS_SOURCES.some((source) => source.key === value);
}
