import type { ReactNode } from "react";
import type { NavIcon } from "@/lib/navigation";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const navPaths: Record<NavIcon, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  teacher: <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 4h5v7h-5" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  quiz: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v2h6V3M8 11l2 2 4-4M8 17h8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M9 14l2 2 4-4" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  team: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-1.5A4.5 4.5 0 0 1 9.5 15h5a4.5 4.5 0 0 1 4.5 4.5V21" /><path d="M19 8h3M20.5 6.5v3" /></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  school: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  graduation: <><path d="m2 9 10-5 10 5-10 5Z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" /></>,
};

export function NavGlyph({ name, size }: { name: NavIcon; size?: number }) {
  return <Svg size={size}>{navPaths[name]}</Svg>;
}

export function MenuIcon() { return <Svg><path d="M3 6h18M3 12h18M3 18h18" /></Svg>; }
export function CloseIcon({ size = 18 }: { size?: number }) { return <Svg size={size}><path d="M18 6 6 18M6 6l12 12" /></Svg>; }
export function SearchIcon({ size = 16 }: { size?: number }) { return <Svg size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>; }
export function ChevronIcon({ size = 15 }: { size?: number }) { return <Svg size={size}><path d="m9 18 6-6-6-6" /></Svg>; }
export function ArrowIcon({ size = 15 }: { size?: number }) { return <Svg size={size}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>; }
export function SunIcon() { return <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>; }
export function MoonIcon() { return <Svg><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>; }
export function LogoutIcon() { return <Svg size={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>; }
export function CollapseIcon() { return <Svg><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 9l-3 3 3 3" /></Svg>; }
export function BoltIcon() { return <Svg size={16}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></Svg>; }
