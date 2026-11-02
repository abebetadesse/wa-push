"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ReportVisual } from "@/components/report-visual";
import type { ReportConfig } from "@/db/schema";
import { AGGREGATIONS, ANALYTICS_SOURCES, FILTER_OPS, VISUALS, type AnalyticsDataset } from "@/lib/analytics-shared";
import { computeReport, emptyConfig, formatNumber } from "@/lib/report-engine";
import { loadDataset, saveReport } from "./actions";

export type ScopeOption = { value: string; label: string; unitId: string | null; schoolId: string | null };
export type SavedReport = { id: string; name: string; description: string | null; config: ReportConfig; isShared: boolean; pinned: boolean; mine: boolean };

/** Starting points modelled on the cluster's pre-primary census and the school's own records. */
export const REPORT_STARTERS: { name: string; config: Partial<ReportConfig> }[] = [
  { name: "Students by sex, per school (census)", config: { source: "schools", visual: "column", rows: ["school"], measures: [{ column: "f.students_female", agg: "sum" }, { column: "f.students_male", agg: "sum" }] } },
  { name: "Students by age group (census)", config: { source: "schools", visual: "stacked", rows: ["school"], measures: [{ column: "f.age4_total", agg: "sum" }, { column: "f.age5_total", agg: "sum" }, { column: "f.age6_total", agg: "sum" }] } },
  { name: "Schools with water, by kebele", config: { source: "schools", visual: "stacked100", rows: ["kebele"], series: "f.has_water", measures: [{ column: "", agg: "count" }] } },
  { name: "Facilities coverage (schools with each)", config: { source: "schools", visual: "bar", rows: [], measures: ["has_water", "has_toilet", "has_electricity", "has_outdoor_play", "has_indoor_play", "has_dining", "has_nap_room", "has_feeding_program"].map((key) => ({ column: `f.${key}.count`, agg: "sum" })) } },
  { name: "Teachers by qualification (census)", config: { source: "schools", visual: "donut", rows: [], measures: ["teachers_below_certificate", "teachers_certificate", "teachers_diploma", "teachers_degree", "teachers_masters"].map((key) => ({ column: `f.${key}`, agg: "sum" })) } },
  { name: "Students per main teacher, by school", config: { source: "schools", visual: "bar", rows: ["school"], measures: [{ column: "f.pupil_teacher_ratio", agg: "avg" }], sort: "value_desc" } },
  { name: "Cluster totals (KPI)", config: { source: "schools", visual: "kpi", rows: [], measures: [{ column: "f.students_total", agg: "sum" }, { column: "f.all_teachers_total", agg: "sum" }, { column: "f.parents_participating", agg: "sum" }, { column: "f.dropouts_total", agg: "sum" }] } },
  { name: "Students by grade and sex", config: { source: "students", visual: "column", rows: ["grade"], series: "gender", measures: [{ column: "", agg: "count" }] } },
  { name: "Attendance by month and status", config: { source: "attendance", visual: "stacked100", rows: ["month"], series: "status", measures: [{ column: "records", agg: "sum" }] } },
  { name: "Average score by subject and sex", config: { source: "results", visual: "column", rows: ["subject"], series: "gender", measures: [{ column: "percent", agg: "avg" }] } },
  { name: "Score bands by class", config: { source: "results", visual: "heatmap", rows: ["classroom"], series: "band", measures: [{ column: "", agg: "count" }] } },
];

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReportBuilder({ scopes, periods, saved, initial }: { scopes: ScopeOption[]; periods: string[]; saved: SavedReport[]; initial?: SavedReport }) {
  const [config, setConfig] = useState<ReportConfig>(() => initial?.config ?? { ...emptyConfig(), period: periods[0] ?? "" });
  const [reportId, setReportId] = useState(initial?.mine ? initial.id : "");
  const [name, setName] = useState(initial?.name ?? "");
  const [datasets, setDatasets] = useState<Record<string, AnalyticsDataset>>({});
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const [saveState, saveAction, saving] = useActionState(saveReport, {});
  const scopeValue = config.scope.schoolId ? `school:${config.scope.schoolId}` : config.scope.unitId ? `unit:${config.scope.unitId}` : "all";
  const cacheKey = `${config.source}|${scopeValue}|${config.period}`;
  const dataset = datasets[cacheKey];

  useEffect(() => {
    if (datasets[cacheKey]) return;
    startLoading(async () => {
      const response = await loadDataset(config.source, config.scope, config.period);
      if (response.error || !response.data) setError(response.error ?? "The data could not be loaded.");
      else {
        setError("");
        setDatasets((current) => ({ ...current, [cacheKey]: response.data! }));
      }
    });
  }, [cacheKey, config.source, config.scope, config.period, datasets]);

  const result = useMemo(() => (dataset ? computeReport(dataset, config) : null), [dataset, config]);
  const columns = dataset?.columns ?? [];
  const categories = columns.filter((column) => column.kind === "category");
  const numbers = columns.filter((column) => column.kind === "number");
  const groups = (list: typeof columns) => [...new Set(list.map((column) => column.group))].map((group) => ({ group, items: list.filter((column) => column.group === group) }));
  const update = (patch: Partial<ReportConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const missing = [...config.rows, config.series, ...config.measures.map((measure) => measure.column), ...config.filters.map((filter) => filter.column)]
    .filter((key): key is string => Boolean(key)).filter((key) => dataset && !columns.some((column) => column.key === key));

  function exportCsv() {
    if (!result) return;
    const bySeries = Boolean(result.seriesColumn);
    const header = [...(result.rowColumns.length ? result.rowColumns.map((column) => column.label) : [""]), ...(bySeries ? [...result.series, "Total"] : result.measures.map((measure) => measure.label))];
    const body = result.rows.map((row) => [...row.labels, ...(bySeries ? [...row.values.map((cell) => cell[0]), row.total[0]] : row.total)]);
    const text = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(name || "report").replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const columnSelect = (value: string, onChange: (value: string) => void, list: typeof columns, placeholder: string, label: string) => (
    <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>
      <option value="">{placeholder}</option>
      {groups(list).map(({ group, items }) => <optgroup key={group} label={group}>{items.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</optgroup>)}
      {value && !list.some((column) => column.key === value) && <option value={value}>{value} (not in this data)</option>}
    </select>
  );

  return (
    <div className="report-builder">
      <aside className="builder-panel" aria-label="Report settings">
        <label>Start from
          <select onChange={(event) => {
            const starter = REPORT_STARTERS[Number(event.target.value)];
            if (starter) { setConfig((current) => ({ ...emptyConfig(), period: current.period, scope: current.scope, ...starter.config } as ReportConfig)); setName(starter.name); setReportId(""); }
            event.target.value = "";
          }} value="">
            <option value="">A ready-made report…</option>
            {REPORT_STARTERS.map((starter, index) => <option key={starter.name} value={index}>{starter.name}</option>)}
          </select>
        </label>
        <label>Data
          <select onChange={(event) => update({ source: event.target.value, rows: [], series: null, measures: [{ column: "", agg: "count" }], filters: [] })} value={config.source}>
            {ANALYTICS_SOURCES.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}
          </select>
          <small className="field-help">{ANALYTICS_SOURCES.find((source) => source.key === config.source)?.description}</small>
        </label>
        <label>Scope
          <select onChange={(event) => {
            const option = scopes.find((entry) => entry.value === event.target.value);
            update({ scope: { unitId: option?.unitId ?? null, schoolId: option?.schoolId ?? null } });
          }} value={scopeValue}>
            {scopes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>Period (for yearly fields)
          <input list="report-periods" maxLength={20} onChange={(event) => update({ period: event.target.value })} value={config.period} />
          <datalist id="report-periods">{periods.map((period) => <option key={period} value={period} />)}</datalist>
        </label>
        <fieldset>
          <legend>Visual</legend>
          <div className="visual-picker">
            {VISUALS.map((visual) => <button aria-pressed={config.visual === visual.key} key={visual.key} onClick={() => update({ visual: visual.key })} type="button">{visual.label}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Rows (group by)</legend>
          {[0, 1, 2].slice(0, Math.min(3, config.rows.length + 1)).map((index) => (
            <div className="builder-line" key={index}>
              {columnSelect(config.rows[index] ?? "", (value) => update({ rows: [...config.rows.slice(0, index), ...(value ? [value] : []), ...config.rows.slice(index + 1)].filter(Boolean) }), categories, index === 0 ? "No grouping (one total)" : "Then by…", `Row group ${index + 1}`)}
            </div>
          ))}
        </fieldset>
        <label>Series / columns (colour, legend)
          {columnSelect(config.series ?? "", (value) => update({ series: value || null }), categories, "None", "Series")}
        </label>
        <fieldset>
          <legend>Values</legend>
          {config.measures.map((measure, index) => (
            <div className="builder-line" key={index}>
              <select aria-label={`Aggregation ${index + 1}`} onChange={(event) => update({ measures: config.measures.map((item, position) => position === index ? { ...item, agg: event.target.value } : item) })} value={measure.agg}>
                {AGGREGATIONS.map((agg) => <option key={agg.key} value={agg.key}>{agg.label}</option>)}
              </select>
              {measure.agg !== "count" && columnSelect(measure.column, (value) => update({ measures: config.measures.map((item, position) => position === index ? { ...item, column: value } : item) }), measure.agg === "distinct" ? columns : numbers, "Choose a number…", `Value ${index + 1}`)}
              {config.measures.length > 1 && <button aria-label="Remove value" className="text-btn" onClick={() => update({ measures: config.measures.filter((_, position) => position !== index) })} type="button">×</button>}
            </div>
          ))}
          {config.measures.length < 8 && <button className="secondary-button" onClick={() => update({ measures: [...config.measures, { column: numbers[0]?.key ?? "", agg: "sum" }] })} type="button">Add a value</button>}
        </fieldset>
        <fieldset>
          <legend>Filters</legend>
          {config.filters.map((filter, index) => (
            <div className="builder-line" key={index}>
              {columnSelect(filter.column, (value) => update({ filters: config.filters.map((item, position) => position === index ? { ...item, column: value } : item) }), columns, "Column…", `Filter ${index + 1} column`)}
              <select aria-label={`Filter ${index + 1} test`} onChange={(event) => update({ filters: config.filters.map((item, position) => position === index ? { ...item, op: event.target.value } : item) })} value={filter.op}>
                {FILTER_OPS.map((op) => <option key={op.key} value={op.key}>{op.label}</option>)}
              </select>
              {!["empty", "notempty"].includes(filter.op) && (
                <>
                  <input aria-label={`Filter ${index + 1} value`} list={`filter-values-${index}`} onChange={(event) => update({ filters: config.filters.map((item, position) => position === index ? { ...item, value: event.target.value } : item) })} value={filter.value} />
                  <datalist id={`filter-values-${index}`}>{dataset && filter.column && [...new Set(dataset.rows.map((row) => row[columns.findIndex((column) => column.key === filter.column)]).filter((value) => value !== null))].slice(0, 200).map((value) => <option key={String(value)} value={String(value)} />)}</datalist>
                </>
              )}
              <button aria-label="Remove filter" className="text-btn" onClick={() => update({ filters: config.filters.filter((_, position) => position !== index) })} type="button">×</button>
            </div>
          ))}
          <button className="secondary-button" onClick={() => update({ filters: [...config.filters, { column: categories[0]?.key ?? "", op: "eq", value: "" }] })} type="button">Add a filter</button>
        </fieldset>
        <div className="builder-line">
          <label>Sort<select onChange={(event) => update({ sort: event.target.value as ReportConfig["sort"] })} value={config.sort}><option value="label">By name</option><option value="value_desc">Largest first</option><option value="value_asc">Smallest first</option></select></label>
          <label>Show top<input className="number-input" min={0} onChange={(event) => update({ limit: Math.max(0, Number(event.target.value) || 0) })} placeholder="all" type="number" value={config.limit || ""} /></label>
        </div>
        <label className="checkbox-label"><input checked={config.showPercent} onChange={(event) => update({ showPercent: event.target.checked })} type="checkbox" /> Show % of total in tables</label>
      </aside>

      <section className="builder-canvas" aria-busy={loading}>
        <div className="builder-toolbar">
          <h2>{name || "Untitled report"}</h2>
          <span className="inline-actions">
            <button className="secondary-button" disabled={!result} onClick={exportCsv} type="button">Export CSV</button>
            <button className="secondary-button" onClick={() => window.print()} type="button">Print / PDF</button>
          </span>
        </div>
        {loading && !dataset && <p className="empty-state">Loading data…</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {missing.length > 0 && <p className="auth-note">Some fields of this report are not in this data or scope: {missing.join(", ")}. Add them in Data fields or choose another scope.</p>}
        {dataset && result && (
          <>
            <p className="builder-meta">
              {formatNumber(result.matched)} of {formatNumber(dataset.rows.length)} rows · {dataset.schoolCount} school{dataset.schoolCount === 1 ? "" : "s"}{dataset.period ? ` · ${dataset.period}` : ""}
              {dataset.truncated && " · only the first 60 000 rows were loaded"}{result.hiddenRows > 0 && ` · ${result.hiddenRows} more groups hidden by “Show top”`}
            </p>
            <div className="viz-root"><ReportVisual result={result} showPercent={config.showPercent} visual={config.visual} /></div>
            {!["table", "matrix", "heatmap", "kpi"].includes(config.visual) && (
              <details className="builder-data"><summary>Data table</summary><ReportVisual result={result} showPercent={config.showPercent} visual="table" /></details>
            )}
          </>
        )}
        <form action={saveAction} className="auth-form builder-save">
          <input name="config" type="hidden" value={JSON.stringify(config)} />
          {reportId && <input name="reportId" type="hidden" value={reportId} />}
          <div className="form-two-columns">
            <label>Report name<input maxLength={160} name="name" onChange={(event) => setName(event.target.value)} required value={name} /></label>
            <label>Description <span className="optional-label">Optional</span><input defaultValue={initial?.description ?? ""} maxLength={500} name="description" /></label>
            <label className="checkbox-label"><input defaultChecked={initial?.isShared} name="isShared" type="checkbox" /> Share with everyone who can read reports</label>
            <label className="checkbox-label"><input defaultChecked={initial?.pinned ?? true} name="pinned" type="checkbox" /> Pin to my dashboard</label>
          </div>
          {saveState.error && <p className="auth-error" role="alert">{saveState.error}</p>}
          {saveState.success && <p className="auth-success" role="status">{saveState.success}</p>}
          <span className="inline-actions">
            <button className="primary-button" disabled={saving} type="submit">{saving ? "Saving…" : reportId ? "Save changes" : "Save report"}</button>
            {reportId && <button className="secondary-button" onClick={() => setReportId("")} type="button">Save as a new report instead</button>}
          </span>
        </form>
        {saved.length > 0 && <p className="field-help">{saved.length} saved report{saved.length === 1 ? "" : "s"} — open them from the Saved reports tab.</p>}
      </section>
    </div>
  );
}

/** A pinned report on the dashboard: loads its own data and renders its visual. */
export function DashboardTile({ report }: { report: SavedReport }) {
  const [dataset, setDataset] = useState<AnalyticsDataset | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadDataset(report.config.source, report.config.scope, report.config.period).then((response) => {
      if (cancelled) return;
      if (response.data) setDataset(response.data);
      else setError(response.error ?? "Could not load.");
    });
    return () => { cancelled = true; };
  }, [report]);
  const result = dataset ? computeReport(dataset, report.config) : null;
  return (
    <article className="management-card dashboard-tile">
      <h3>{report.name}</h3>
      {report.description && <p className="field-help">{report.description}</p>}
      {error && <p className="auth-error">{error}</p>}
      {!dataset && !error && <p className="empty-state">Loading…</p>}
      {result && <div className="viz-root"><ReportVisual result={result} showPercent={report.config.showPercent} visual={report.config.visual} /></div>}
    </article>
  );
}
