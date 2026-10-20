"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";

/**
 * Instant filter for a server-rendered list: hides the children of the element with `targetId`
 * whose text does not contain every word typed. Works on any list without changing its markup.
 */
export function ListSearch({ targetId, label, placeholder }: { targetId: string; label: string; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const statusRef = useRef<HTMLSpanElement>(null);

  // Runs after every render too, so rows added by a server action are filtered as well.
  useEffect(() => {
    const list = document.getElementById(targetId);
    if (!list) return;
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const rows = Array.from(list.children).filter((row) => !row.classList.contains("list-search-empty")) as HTMLElement[];
    for (const row of rows) {
      const text = row.textContent?.toLowerCase() ?? "";
      const match = terms.every((term) => text.includes(term));
      row.hidden = !match;
      if (match) shown += 1;
    }
    let empty = list.querySelector<HTMLElement>(":scope > .list-search-empty");
    if (terms.length && shown === 0) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "list-search-empty";
        list.append(empty);
      }
      empty.textContent = `Nothing matches “${query.trim()}”.`;
    } else {
      empty?.remove();
    }
    if (statusRef.current) statusRef.current.textContent = terms.length ? `${shown} of ${rows.length} shown` : "";
  });

  return (
    <div className="list-search" role="search">
      <SearchIcon />
      <input
        aria-label={label}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
        placeholder={placeholder ?? label}
        type="search"
        value={query}
      />
      <span aria-live="polite" className="visually-hidden" ref={statusRef} />
    </div>
  );
}
