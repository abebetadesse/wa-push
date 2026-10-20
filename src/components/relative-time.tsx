"use client";

import { useSyncExternalStore } from "react";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}

// Minute-resolution clock, so the snapshot only changes once a minute.
const now = () => Math.floor(Date.now() / 60_000) * 60_000;

/** "5 minutes ago", refreshed every minute; the server renders the absolute date. */
export function RelativeTime({ value }: { value: string }) {
  const current = useSyncExternalStore(subscribe, now, () => 0);
  const date = new Date(value);
  const absolute = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: current ? undefined : "UTC" }).format(date);
  let label = absolute;
  if (current) {
    const seconds = Math.round((date.getTime() - current) / 1000);
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const unit = units.find(([, size]) => Math.abs(seconds) >= size);
    label = unit ? formatter.format(Math.round(seconds / unit[1]), unit[0]) : "just now";
  }
  return <time dateTime={value} title={absolute}>{label}</time>;
}
