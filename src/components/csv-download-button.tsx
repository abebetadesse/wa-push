"use client";

import { useState } from "react";

type CsvCell = string | number | null | undefined;

export function CsvDownloadButton({
  filename,
  headers,
  rows,
  label = "Export CSV",
  filterTargetId,
}: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
  label?: string;
  filterTargetId?: string;
}) {
  const [status, setStatus] = useState("");

  function download() {
    const visibleIndexes = filterTargetId
      ? Array.from(document.getElementById(filterTargetId)?.children ?? [])
        .flatMap((element, index) => (element as HTMLElement).hidden ? [] : [index])
      : rows.map((_, index) => index);
    const exportRows = rows.filter((_, index) => visibleIndexes.includes(index));
    const csvRows = [headers, ...exportRows].map((row) => row.map((value) => {
      let cell = String(value ?? "");
      if (/^[\t\r\n ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    }).join(","));
    const blob = new Blob(["\uFEFF", csvRows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("CSV download started.");
  }

  return <>
    <button className="secondary-button" onClick={download} type="button">{label}</button>
    <span className="visually-hidden" role="status">{status}</span>
  </>;
}
