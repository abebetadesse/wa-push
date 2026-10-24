"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type ProgressRow = {
  id: string;
  name: string;
  studentNumber: string;
  average: string;
  assessments: number;
  attendance: string;
  recordedDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

export function ProgressTable({ rows }: { rows: ProgressRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printReady, setPrintReady] = useState(false);
  const selectedRows = rows.filter(({ id }) => selected.has(id));

  useEffect(() => {
    if (!printReady || !selectedRows.length) return;
    document.body.classList.add("printing-batch");
    const cleanup = () => {
      document.body.classList.remove("printing-batch");
      setPrintReady(false);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 2000);
    return () => window.removeEventListener("afterprint", cleanup);
  }, [printReady, selectedRows.length]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return <>
    <div className="inline-actions batch-print-actions">
      <button className="secondary-button" onClick={() => setSelected(new Set(rows.map(({ id }) => id)))} type="button">Select all</button>
      <button className="secondary-button" onClick={() => setSelected(new Set())} type="button">Clear selection</button>
      <button className="primary-button" disabled={!selected.size} onClick={() => setPrintReady(true)} type="button">Print selected summaries ({selected.size})</button>
    </div>
    <div className="report-table-wrap">
      <table className="report-table">
        <thead><tr><th>Select</th><th>Student</th><th>Assessment average</th><th>Assessments</th><th>Attendance</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Report</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td><input aria-label={`Select ${row.name} for batch print`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} type="checkbox" /></td>
          <td><strong>{row.name}</strong><small>{row.studentNumber}</small></td>
          <td>{row.average}</td><td>{row.assessments}</td>
          <td>{row.attendance}<small>{row.recordedDays} recorded days</small></td>
          <td>{row.present}</td><td>{row.absent}</td><td>{row.late}</td><td>{row.excused}</td>
          <td><Link className="secondary-button" href={`/students/${row.id}/report-card`}>Report card</Link></td>
        </tr>)}</tbody>
      </table>
    </div>
    <section aria-hidden="true" className="batch-print-area">
      <h1>Student progress summaries</h1>
      {selectedRows.map((row) => <article className="batch-print-card" key={row.id}>
        <h2>{row.name}</h2>
        <p>Student number: {row.studentNumber}</p>
        <dl>
          <div><dt>Assessment average</dt><dd>{row.average}</dd></div>
          <div><dt>Assessments recorded</dt><dd>{row.assessments}</dd></div>
          <div><dt>Attendance rate</dt><dd>{row.attendance}</dd></div>
          <div><dt>Recorded days</dt><dd>{row.recordedDays}</dd></div>
          <div><dt>Present</dt><dd>{row.present}</dd></div>
          <div><dt>Absent</dt><dd>{row.absent}</dd></div>
          <div><dt>Late</dt><dd>{row.late}</dd></div>
          <div><dt>Excused</dt><dd>{row.excused}</dd></div>
        </dl>
      </article>)}
    </section>
  </>;
}
