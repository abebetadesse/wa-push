"use client";

import { useState, type ReactNode } from "react";
import { formatNumber, type ReportResult } from "@/lib/report-engine";

// Charts for the report builder and dashboard. Colors come from the --series-N and --seq-N tokens on
// .viz-root (globals.css): eight categorical hues in a fixed order, so a series keeps its color when
// filters change, and anything past eight folds into "Other".
const MAX_SERIES = 8;

type Series = { key: string; label: string; color: string; values: (number | null)[] };
type ChartData = { categories: string[]; series: Series[]; measureLabel: string };

function chartData(result: ReportResult): ChartData {
  // One group and several values (e.g. "schools with water, toilet, electricity…"): the values become
  // the categories of a single series.
  if (!result.seriesColumn && result.rows.length === 1 && result.measures.length > 1) {
    return {
      categories: result.measures.map((measure) => measure.label.replace(/^(Sum|Average|Minimum|Maximum|Median|Distinct count) of /, "")),
      series: [{ key: "values", label: result.rows[0].labels.join(" · "), color: "var(--series-1)", values: result.rows[0].total }],
      measureLabel: "Value",
    };
  }
  const categories = result.rows.map((row) => row.labels.join(" · "));
  const seriesColor = (index: number) => `var(--series-${index + 1})`;
  let series: Series[];
  if (result.seriesColumn) {
    // Series ranked by size get colors in order; past eight, the rest are summed into "Other".
    const ranked = result.series.map((key, index) => ({ key, index, total: result.rows.reduce((sum, row) => sum + (row.values[index][0] ?? 0), 0) }))
      .sort((a, b) => b.total - a.total);
    const kept = ranked.length > MAX_SERIES ? ranked.slice(0, MAX_SERIES - 1) : ranked;
    const keptOrder = [...kept].sort((a, b) => a.index - b.index);
    series = keptOrder.map((entry, position) => ({ key: entry.key, label: entry.key || "(blank)", color: seriesColor(position), values: result.rows.map((row) => row.values[entry.index][0]) }));
    if (ranked.length > MAX_SERIES) {
      const folded = ranked.slice(MAX_SERIES - 1).map((entry) => entry.index);
      series.push({ key: "__other", label: `Other (${folded.length})`, color: "var(--series-other)", values: result.rows.map((row) => folded.reduce((sum, index) => sum + (row.values[index][0] ?? 0), 0)) });
    }
  } else {
    series = result.measures.slice(0, MAX_SERIES).map((measure, index) => ({ key: measure.key, label: measure.label, color: seriesColor(index), values: result.rows.map((row) => row.total[index]) }));
  }
  return { categories, series, measureLabel: result.measures[0]?.label ?? "Value" };
}

function niceTicks(max: number, count = 5) {
  if (max <= 0) return [0, 1];
  const step = 10 ** Math.floor(Math.log10(max / count));
  const nice = [1, 2, 2.5, 5, 10].map((factor) => factor * step).find((candidate) => max / candidate <= count) ?? step * 10;
  const ticks = [];
  for (let value = 0; value <= max + nice * 0.001; value += nice) ticks.push(Math.round(value * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + nice);
  return ticks;
}

const truncate = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

type Tip = { x: number; y: number; title: string; lines: { color: string; label: string; value: string }[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="viz-tooltip" role="status" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
      <strong>{tip.title}</strong>
      {tip.lines.map((line) => <span key={line.label}><i style={{ background: line.color }} />{line.label}<b>{line.value}</b></span>)}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return <ul className="viz-legend">{series.map((entry) => <li key={entry.key}><i style={{ background: entry.color }} />{entry.label}</li>)}</ul>;
}

/** A rounded-end bar: only the data end (top, or right for horizontal bars) is rounded. */
function barPath(x: number, y: number, width: number, height: number, horizontal: boolean, rounded: boolean) {
  const r = rounded ? Math.min(4, width / 2, height / 2) : 0;
  if (horizontal) return `M${x},${y} h${width - r} a${r},${r} 0 0 1 ${r},${r} v${height - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${width - r} Z`;
  return `M${x},${y + height} v-${height - r} a${r},${r} 0 0 1 ${r},-${r} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - r} Z`;
}

function ColumnChart({ data, mode, horizontal }: { data: ChartData; mode: "grouped" | "stacked" | "percent"; horizontal?: boolean }) {
  const [tip, setTip] = useState<Tip>(null);
  const n = data.categories.length;
  const stacked = mode !== "grouped";
  const totals = data.categories.map((_, index) => data.series.reduce((sum, entry) => sum + Math.max(0, entry.values[index] ?? 0), 0));
  const max = mode === "percent" ? 100 : stacked ? Math.max(...totals, 0) : Math.max(0, ...data.series.flatMap((entry) => entry.values.map((value) => value ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const labelSpace = horizontal ? Math.min(220, 40 + Math.max(...data.categories.map((label) => label.length), 4) * 6.2) : 48;
  const width = 760;
  const height = horizontal ? Math.max(180, n * (stacked ? 30 : 16 * data.series.length + 14) + 40) : 340;
  const plot = horizontal ? { x: labelSpace, y: 10, w: width - labelSpace - 24, h: height - 40 } : { x: 56, y: 12, w: width - 72, h: height - 12 - (n > 8 ? 86 : 44) };
  const band = (horizontal ? plot.h : plot.w) / Math.max(n, 1);
  const inner = band * (n > 30 ? 0.86 : 0.7);
  const scale = (value: number) => (value / top) * (horizontal ? plot.w : plot.h);
  const shown = (value: number | null, index: number) => mode === "percent" ? ((value ?? 0) / (totals[index] || 1)) * 100 : value ?? 0;

  const marks: ReactNode[] = [];
  data.categories.forEach((category, index) => {
    let offset = 0;
    const bandStart = (horizontal ? plot.y : plot.x) + index * band + (band - inner) / 2;
    const visible = data.series.filter((entry) => (entry.values[index] ?? 0) > 0);
    data.series.forEach((entry, seriesIndex) => {
      const value = shown(entry.values[index], index);
      if (!value) return;
      const length = scale(value);
      const thickness = stacked ? inner : Math.max(2, inner / data.series.length - 2);
      const along = stacked ? bandStart : bandStart + seriesIndex * (thickness + 2);
      const isTop = !stacked || entry === visible[visible.length - 1];
      // A 2px surface gap between stacked segments.
      const gap = stacked && !isTop ? 2 : 0;
      const d = horizontal
        ? barPath(plot.x + offset, along, Math.max(0, length - gap), thickness, true, isTop)
        : barPath(along, plot.y + plot.h - offset - length + gap, thickness, Math.max(0, length - gap), false, isTop);
      const lines = (stacked ? data.series : [entry]).map((item) => ({
        color: item.color,
        label: item.label,
        value: mode === "percent" ? `${formatNumber(shown(item.values[index], index))}% (${formatNumber(item.values[index])})` : formatNumber(item.values[index]),
      }));
      marks.push(
        <path
          className="viz-mark"
          d={d}
          fill={entry.color}
          key={`${index}-${entry.key}`}
          onMouseEnter={() => setTip({ x: ((horizontal ? plot.x + offset + length : along + thickness / 2) / width) * 100, y: ((horizontal ? along : plot.y + plot.h - offset - length) / height) * 100, title: category, lines })}
          onMouseLeave={() => setTip(null)}
        />,
      );
      if (stacked) offset += length;
    });
  });

  return (
    <div className="viz-frame">
      <Legend series={data.series} />
      <div className="viz-plot">
        <svg aria-label={`${data.measureLabel} by category`} role="img" viewBox={`0 0 ${width} ${height}`}>
          {ticks.map((tick) => {
            const at = scale(tick);
            return horizontal
              ? <g key={tick}><line className="viz-grid" x1={plot.x + at} x2={plot.x + at} y1={plot.y} y2={plot.y + plot.h} /><text className="viz-axis" textAnchor="middle" x={plot.x + at} y={plot.y + plot.h + 16}>{formatNumber(tick)}{mode === "percent" ? "%" : ""}</text></g>
              : <g key={tick}><line className="viz-grid" x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h - at} y2={plot.y + plot.h - at} /><text className="viz-axis" textAnchor="end" x={plot.x - 8} y={plot.y + plot.h - at + 4}>{formatNumber(tick)}{mode === "percent" ? "%" : ""}</text></g>;
          })}
          {marks}
          {data.categories.map((category, index) => {
            const center = (horizontal ? plot.y : plot.x) + index * band + band / 2;
            if (horizontal) return <text className="viz-axis viz-category" key={category + index} textAnchor="end" x={plot.x - 8} y={center + 4}>{truncate(category, 34)}</text>;
            if (n > 40 && index % Math.ceil(n / 40) !== 0) return null;
            return n > 8
              ? <text className="viz-axis viz-category" key={category + index} textAnchor="end" transform={`rotate(-40 ${center} ${plot.y + plot.h + 14})`} x={center} y={plot.y + plot.h + 14}>{truncate(category, 18)}</text>
              : <text className="viz-axis viz-category" key={category + index} textAnchor="middle" x={center} y={plot.y + plot.h + 18}>{truncate(category, 16)}</text>;
          })}
          {/* Direct labels on single-series columns, only when they fit. */}
          {!stacked && data.series.length === 1 && n <= 12 && data.categories.map((category, index) => {
            const value = data.series[0].values[index];
            if (!value) return null;
            const center = (horizontal ? plot.y : plot.x) + index * band + band / 2;
            const length = scale(value);
            return horizontal
              ? <text className="viz-value" key={`v${category}${index}`} x={plot.x + length + 6} y={center + 4}>{formatNumber(value)}</text>
              : <text className="viz-value" key={`v${category}${index}`} textAnchor="middle" x={center} y={plot.y + plot.h - length - 6}>{formatNumber(value)}</text>;
          })}
          <line className="viz-baseline" x1={plot.x} x2={horizontal ? plot.x : plot.x + plot.w} y1={horizontal ? plot.y : plot.y + plot.h} y2={plot.y + plot.h} />
        </svg>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

function LineChart({ data, area }: { data: ChartData; area?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = data.categories.length;
  const width = 760;
  const height = 320;
  const plot = { x: 56, y: 14, w: width - 80, h: height - 14 - (n > 8 ? 86 : 44) };
  const max = Math.max(0, ...data.series.flatMap((entry) => entry.values.map((value) => value ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (index: number) => plot.x + (n <= 1 ? plot.w / 2 : (index / (n - 1)) * plot.w);
  const y = (value: number) => plot.y + plot.h - (value / top) * plot.h;
  return (
    <div className="viz-frame">
      <Legend series={data.series} />
      <div className="viz-plot">
        <svg aria-label={`${data.measureLabel} over categories`} onMouseLeave={() => setHover(null)} role="img" viewBox={`0 0 ${width} ${height}`}>
          {ticks.map((tick) => <g key={tick}><line className="viz-grid" x1={plot.x} x2={plot.x + plot.w} y1={y(tick)} y2={y(tick)} /><text className="viz-axis" textAnchor="end" x={plot.x - 8} y={y(tick) + 4}>{formatNumber(tick)}</text></g>)}
          {data.series.map((entry) => {
            const points = entry.values.map((value, index) => (value === null ? null : [x(index), y(value)] as const));
            const path = points.reduce((d, point, index) => (point ? `${d}${d && points[index - 1] ? " L" : " M"}${point[0]},${point[1]}` : d), "");
            return (
              <g key={entry.key}>
                {area && data.series.length === 1 && path && <path d={`${path} L${x(n - 1)},${plot.y + plot.h} L${x(0)},${plot.y + plot.h} Z`} fill={entry.color} opacity={0.14} />}
                <path className="viz-line" d={path} stroke={entry.color} />
                {n <= 40 && points.map((point, index) => point && <circle className="viz-dot" cx={point[0]} cy={point[1]} fill={entry.color} key={index} r={hover === index ? 5 : 3.5} />)}
              </g>
            );
          })}
          {hover !== null && <line className="viz-crosshair" x1={x(hover)} x2={x(hover)} y1={plot.y} y2={plot.y + plot.h} />}
          {data.categories.map((category, index) => (
            <rect fill="transparent" height={plot.h} key={`hit${index}`} onMouseEnter={() => setHover(index)} width={Math.max(8, plot.w / Math.max(n, 1))} x={x(index) - plot.w / Math.max(n, 1) / 2} y={plot.y} />
          ))}
          {data.categories.map((category, index) => {
            if (n > 24 && index % Math.ceil(n / 24) !== 0) return null;
            return n > 8
              ? <text className="viz-axis viz-category" key={category + index} textAnchor="end" transform={`rotate(-40 ${x(index)} ${plot.y + plot.h + 14})`} x={x(index)} y={plot.y + plot.h + 14}>{truncate(category, 18)}</text>
              : <text className="viz-axis viz-category" key={category + index} textAnchor="middle" x={x(index)} y={plot.y + plot.h + 18}>{truncate(category, 16)}</text>;
          })}
          <line className="viz-baseline" x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} />
        </svg>
        {hover !== null && <Tooltip tip={{ x: (x(hover) / width) * 100, y: 4, title: data.categories[hover], lines: data.series.map((entry) => ({ color: entry.color, label: entry.label, value: formatNumber(entry.values[hover]) })) }} />}
      </div>
    </div>
  );
}

function PieChart({ data, donut }: { data: ChartData; donut?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  // A pie shows one measure across the categories; more than eight slices fold into "Other".
  const entries = data.categories.map((label, index) => ({ label, value: Math.max(0, data.series[0]?.values[index] ?? 0) })).filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const slices = entries.length > MAX_SERIES ? [...entries.slice(0, MAX_SERIES - 1), { label: `Other (${entries.length - MAX_SERIES + 1})`, value: entries.slice(MAX_SERIES - 1).reduce((sum, entry) => sum + entry.value, 0) }] : entries;
  const total = slices.reduce((sum, entry) => sum + entry.value, 0) || 1;
  // Each slice starts where the previous one ended, from 12 o'clock.
  const starts = slices.map((_, index) => -Math.PI / 2 + slices.slice(0, index).reduce((sum, entry) => sum + (entry.value / total) * Math.PI * 2, 0));
  const radius = 120;
  const innerRadius = donut ? 70 : 0;
  const arc = (start: number, end: number, r: number) => [Math.cos(start) * r, Math.sin(start) * r, Math.cos(end) * r, Math.sin(end) * r];
  return (
    <div className="viz-frame viz-pie">
      <div className="viz-plot">
        <svg aria-label={`${data.measureLabel} share by category`} role="img" viewBox="-140 -140 280 280">
          {slices.map((slice, index) => {
            const start = starts[index];
            const sweep = (slice.value / total) * Math.PI * 2;
            const end = start + sweep - (slices.length > 1 ? 0.012 : 0);
            const large = sweep > Math.PI ? 1 : 0;
            const [x1, y1, x2, y2] = arc(start, end, active === index ? radius + 6 : radius);
            const [ix1, iy1, ix2, iy2] = arc(start, end, innerRadius);
            const color = index === MAX_SERIES - 1 && entries.length > MAX_SERIES ? "var(--series-other)" : `var(--series-${index + 1})`;
            const d = slices.length === 1
              ? `M0,-${radius} A${radius},${radius} 0 1 1 -0.01,-${radius} Z`
              : innerRadius
                ? `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${innerRadius},${innerRadius} 0 ${large} 0 ${ix1},${iy1} Z`
                : `M0,0 L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`;
            return <path className="viz-mark" d={d} fill={color} key={slice.label} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} />;
          })}
          {donut && <><text className="viz-hero" textAnchor="middle" y={4}>{formatNumber(total)}</text><text className="viz-axis" textAnchor="middle" y={24}>total</text></>}
        </svg>
      </div>
      <ul className="viz-legend viz-legend-list">
        {slices.map((slice, index) => (
          <li aria-current={active === index ? "true" : undefined} key={slice.label} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
            <i style={{ background: index === MAX_SERIES - 1 && entries.length > MAX_SERIES ? "var(--series-other)" : `var(--series-${index + 1})` }} />
            {slice.label}<b>{formatNumber(slice.value)} · {formatNumber((slice.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpis({ result }: { result: ReportResult }) {
  return (
    <div className="viz-kpis">
      {result.measures.map((measure, index) => (
        <div className="viz-kpi" key={measure.key}>
          <span>{measure.label}</span>
          <strong>{formatNumber(result.grand[index])}</strong>
          {result.rows.length > 1 && <small>Highest: {[...result.rows].sort((a, b) => (b.total[index] ?? -Infinity) - (a.total[index] ?? -Infinity))[0].labels.join(" · ")} ({formatNumber([...result.rows].sort((a, b) => (b.total[index] ?? -Infinity) - (a.total[index] ?? -Infinity))[0].total[index])})</small>}
        </div>
      ))}
      <div className="viz-kpi"><span>Rows matched</span><strong>{formatNumber(result.matched)}</strong>{result.rowColumns.length > 0 && <small>{result.rows.length} groups</small>}</div>
    </div>
  );
}

function percentOf(value: number | null, total: number | null) {
  return value === null || !total ? "" : `${formatNumber((value / total) * 100)}%`;
}

export function ReportTable({ result, showPercent }: { result: ReportResult; showPercent: boolean }) {
  const bySeries = Boolean(result.seriesColumn);
  return (
    <div className="report-table-wrap">
      <table className="report-table viz-table">
        <thead>
          <tr>
            {(result.rowColumns.length ? result.rowColumns : [{ key: "all", label: "" }]).map((column) => <th key={column.key} scope="col">{column.label}</th>)}
            {bySeries
              ? result.series.map((series) => <th className="numeric" key={series} scope="col">{series || "(blank)"}</th>)
              : result.measures.map((measure) => <th className="numeric" key={measure.key} scope="col">{measure.label}</th>)}
            {bySeries && <th className="numeric" scope="col">Total</th>}
            {showPercent && <th className="numeric" scope="col">% of total</th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.key}>
              {row.labels.map((label, index) => <td key={index}>{label}</td>)}
              {bySeries
                ? row.values.map((values, index) => <td className="numeric" key={index}>{formatNumber(values[0])}</td>)
                : row.total.map((value, index) => <td className="numeric" key={index}>{formatNumber(value)}</td>)}
              {bySeries && <td className="numeric"><strong>{formatNumber(row.total[0])}</strong></td>}
              {showPercent && <td className="numeric">{percentOf(row.total[0], result.grand[0])}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={Math.max(1, result.rowColumns.length)} scope="row">Total</th>
            {bySeries
              ? result.series.map((series, index) => <td className="numeric" key={series}>{formatNumber(result.measures[0].agg === "count" || result.measures[0].agg === "sum" ? result.rows.reduce((sum, row) => sum + (row.values[index][0] ?? 0), 0) : null)}</td>)
              : result.grand.map((value, index) => <td className="numeric" key={index}>{formatNumber(value)}</td>)}
            {bySeries && <td className="numeric"><strong>{formatNumber(result.grand[0])}</strong></td>}
            {showPercent && <td className="numeric">100%</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Heatmap({ result }: { result: ReportResult }) {
  const values = result.rows.flatMap((row) => (result.seriesColumn ? row.values.map((cell) => cell[0] ?? 0) : row.total.map((value) => value ?? 0)));
  const max = Math.max(...values, 0) || 1;
  const headers = result.seriesColumn ? result.series.map((series) => series || "(blank)") : result.measures.map((measure) => measure.label);
  return (
    <div className="report-table-wrap">
      <table className="report-table viz-heatmap">
        <thead><tr><th scope="col">{result.rowColumns.map((column) => column.label).join(" · ")}</th>{headers.map((header) => <th className="numeric" key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.labels.join(" · ")}</th>
              {(result.seriesColumn ? row.values.map((cell) => cell[0]) : row.total).map((value, index) => {
                const step = value ? Math.min(7, Math.max(1, Math.ceil((value / max) * 7))) : 0;
                return <td className={`numeric heat-${step}`} key={index} title={`${row.labels.join(" · ")} — ${headers[index]}: ${formatNumber(value)}`}>{formatNumber(value)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a computed report as the chosen visual. */
export function ReportVisual({ result, visual, showPercent }: { result: ReportResult; visual: string; showPercent: boolean }) {
  if (result.matched === 0) return <p className="empty-state">No rows match this report. Change the scope, period or filters.</p>;
  const data = chartData(result);
  switch (visual) {
    case "table": return <ReportTable result={result} showPercent={showPercent} />;
    case "matrix": return <ReportTable result={result} showPercent={showPercent} />;
    case "heatmap": return <Heatmap result={result} />;
    case "kpi": return <Kpis result={result} />;
    case "column": return <ColumnChart data={data} mode="grouped" />;
    case "stacked": return <ColumnChart data={data} mode="stacked" />;
    case "stacked100": return <ColumnChart data={data} mode="percent" />;
    case "bar": return <ColumnChart data={data} horizontal mode={result.seriesColumn ? "stacked" : "grouped"} />;
    case "line": return <LineChart data={data} />;
    case "area": return <LineChart area data={data} />;
    case "pie": return <PieChart data={data} />;
    case "donut": return <PieChart data={data} donut />;
    default: return <ReportTable result={result} showPercent={showPercent} />;
  }
}
