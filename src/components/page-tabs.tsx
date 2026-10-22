import Link from "next/link";

/** Links between the sections of one page, kept in the URL as ?tab=… (with any other params). */
export function PageTabs({ basePath, tabs, active, params = {} }: {
  basePath: string;
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  params?: Record<string, string | undefined>;
}) {
  return (
    <nav aria-label="Sections" className="page-tabs">
      {tabs.map((tab) => {
        const query = new URLSearchParams(Object.entries({ ...params, tab: tab.id }).filter((entry): entry is [string, string] => Boolean(entry[1])));
        return (
          <Link aria-current={tab.id === active ? "page" : undefined} className="page-tab" href={`${basePath}?${query}`} key={tab.id}>
            {tab.label}{tab.count !== undefined && <span className="page-tab-count">{tab.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** The active tab: the requested one when it exists, else the first. */
export function activeTab<T extends string>(requested: string | undefined, tabs: readonly T[]) {
  return (tabs as readonly string[]).includes(requested ?? "") ? (requested as T) : tabs[0];
}
