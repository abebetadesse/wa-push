"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { NavItem } from "@/lib/navigation";
import { BoltIcon, LogoutIcon, MoonIcon, NavGlyph, SearchIcon, SunIcon } from "./icons";
import type { Theme } from "./theme";

type Command = {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  search: string;
  run: () => void;
};

export function CommandPalette({
  items,
  onClose,
  onNavigate,
  onSignOut,
  onToggleTheme,
  theme,
}: {
  items: NavItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  onToggleTheme: () => void;
  theme: Theme;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => [
    ...items.map((item) => ({
      id: item.href,
      label: item.label,
      description: item.description,
      group: item.section,
      icon: <NavGlyph name={item.icon} />,
      search: `${item.label} ${item.description} ${item.keywords ?? ""}`.toLowerCase(),
      run: () => onNavigate(item.href),
    })),
    {
      id: "theme",
      label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      description: "Change the colour scheme",
      group: "Preferences",
      icon: theme === "dark" ? <SunIcon /> : <MoonIcon />,
      search: "theme dark light mode colour color appearance",
      run: () => { onToggleTheme(); onClose(); },
    },
    {
      id: "sign-out",
      label: "Sign out",
      description: "End this session on this device",
      group: "Account",
      icon: <LogoutIcon />,
      search: "sign out log out logout exit",
      run: onSignOut,
    },
  ], [items, onClose, onNavigate, onSignOut, onToggleTheme, theme]);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length ? commands.filter((command) => terms.every((term) => command.search.includes(term))) : commands;
  const activeIndex = Math.min(selected, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((activeIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((activeIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[activeIndex]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  let lastGroup = "";
  return (
    <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search pages and actions" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <SearchIcon size={18} />
          <input
            aria-activedescendant={results[activeIndex] ? `palette-${results[activeIndex].id}` : undefined}
            aria-controls="palette-results"
            aria-label="Search pages and actions"
            autoFocus
            onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
            placeholder="Search pages, tools and actions…"
            role="combobox"
            aria-expanded="true"
            value={query}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-results" id="palette-results" ref={listRef} role="listbox">
          {results.length === 0 && <li className="palette-empty"><BoltIcon /> No pages or actions match “{query}”.</li>}
          {results.map((command, index) => {
            const heading = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {heading && <div className="palette-group">{heading}</div>}
                <button
                  aria-selected={index === activeIndex}
                  className={`palette-item${index === activeIndex ? " selected" : ""}`}
                  data-index={index}
                  id={`palette-${command.id}`}
                  onClick={command.run}
                  onMouseMove={() => { if (index !== activeIndex) setSelected(index); }}
                  role="option"
                  type="button"
                >
                  <span className="palette-icon">{command.icon}</span>
                  <span className="palette-copy"><strong>{command.label}</strong><small>{command.description}</small></span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Ctrl K</kbd> to toggle</span></div>
      </div>
    </div>
  );
}
