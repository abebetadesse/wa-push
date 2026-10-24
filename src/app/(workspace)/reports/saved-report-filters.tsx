"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

type SavedFilter = { name: string; query: string };
const storageKey = "forma-saved-report-filters";

function isSavedFilters(value: unknown): value is SavedFilter[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" && item !== null &&
    "name" in item && typeof item.name === "string" &&
    "query" in item && typeof item.query === "string" && item.query.startsWith("?"),
  );
}

function readSavedFilters() {
  try {
    return localStorage.getItem(storageKey);
  } catch (error) {
    console.error("Could not read saved report filters.", error);
    return "!unavailable";
  }
}

function subscribeToSavedFilters(callback: () => void) {
  const listener = () => callback();
  window.addEventListener("forma-saved-report-filters", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("forma-saved-report-filters", listener);
    window.removeEventListener("storage", listener);
  };
}

function writeSavedFilters(filters: SavedFilter[]) {
  localStorage.setItem(storageKey, JSON.stringify(filters));
  window.dispatchEvent(new Event("forma-saved-report-filters"));
}

export function SavedReportFilters({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const subscribe = useCallback((callback: () => void) => subscribeToSavedFilters(callback), []);
  const getSnapshot = useCallback(() => readSavedFilters(), []);
  const getServerSnapshot = useCallback(() => null, []);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const parsed = useMemo(() => {
    if (!stored) return { filters: [] as SavedFilter[], error: "" };
    if (stored === "!unavailable") return { filters: [] as SavedFilter[], error: "Browser storage is unavailable; saved views cannot be loaded." };
    try {
      const value: unknown = JSON.parse(stored);
      if (!isSavedFilters(value)) throw new Error("Saved report filters are invalid.");
      return { filters: value, error: "" };
    } catch (parseError) {
      console.error("Could not parse saved report filters.", parseError);
      return { filters: [] as SavedFilter[], error: "Saved filters are invalid and could not be loaded." };
    }
  }, [stored]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  const saved = parsed.filters;

  function save() {
    const label = name.trim();
    if (!label || !query) {
      setError("Enter a name and apply at least one filter before saving.");
      return;
    }
    const next = [...saved.filter((filter) => filter.name !== label), { name: label, query }];
    try {
      writeSavedFilters(next);
      setSelected(label);
      setName("");
      setError("");
    } catch (saveError) {
      console.error("Could not save report filters.", saveError);
      setError("The filter could not be saved in this browser.");
    }
  }

  function load() {
    const filter = saved.find((item) => item.name === selected);
    if (filter) router.push(`${pathname}${filter.query}`);
  }

  function remove() {
    const next = saved.filter((filter) => filter.name !== selected);
    try {
      writeSavedFilters(next);
      setSelected("");
      setError("");
    } catch (saveError) {
      console.error("Could not remove the saved report filter.", saveError);
      setError("The saved filter could not be removed.");
    }
  }

  return (
    <div className="report-saved-filters">
      <label>Saved views<select value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">Choose a saved view</option>
        {saved.map((filter) => <option key={filter.name} value={filter.name}>{filter.name}</option>)}
      </select></label>
      <button className="secondary-button" disabled={!selected} onClick={load} type="button">Load view</button>
      <button className="secondary-button" disabled={!selected} onClick={remove} type="button">Remove view</button>
      <label>Save current filters<input maxLength={60} onChange={(event) => setName(event.target.value)} value={name} /></label>
      <button className="secondary-button" onClick={save} type="button">Save view</button>
      {(error || parsed.error) && <p className="auth-error" role="alert">{error || parsed.error}</p>}
    </div>
  );
}
