import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RecordForm } from "@/components/record-form";
import { ancestors, descendantIds, loadHierarchy } from "@/lib/hierarchy";
import { requireWorkspaceContext } from "@/lib/workspace";
import { addCluster } from "../actions";

export const metadata: Metadata = { title: "Add a cluster | Forma" };

type SearchParams = Promise<{ woreda?: string }>;

async function AddClusterContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.organization) redirect("/no-access");
  const params = await searchParams;
  const hierarchy = await loadHierarchy();

  // Woredas the user may add clusters to: every one for the super administrator, else those at or
  // below the units they administer.
  const administered = new Set<string>();
  for (const { unitId, role } of context.orgRoles) if (role === "org_admin") for (const id of descendantIds(hierarchy, unitId)) administered.add(id);
  const woredas = hierarchy.units
    .filter((unit) => unit.level === "woreda" && (context.platformAdmin || administered.has(unit.id)))
    .map((unit) => ({ value: unit.id, label: ancestors(hierarchy, unit.id).reverse().map((part) => part.name).join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const preset = woredas.find((woreda) => woreda.value === params.woreda)?.value;
  const clusterCount = hierarchy.units.filter((unit) => unit.level === "cluster" && (context.platformAdmin || administered.has(unit.id))).length;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/organization" className="management-back">← Clusters & hierarchy</Link>
          <p className="auth-eyebrow">ADMINISTRATION</p>
          <h1>Add a school cluster</h1>
          <p className="management-description">A cluster groups the schools of one woreda that work together under a cluster supervisor. Choose its woreda, name it, and list its schools now or add them later.</p>
        </div>
      </header>
      <div className="textbook-summary">
        <div><strong>{clusterCount}</strong><span>clusters you manage</span></div>
        <div><strong>{woredas.length}</strong><span>woredas you can add to</span></div>
      </div>
      <div className="management-sections">
        <section className="management-card">
          {woredas.length === 0 ? (
            <p className="empty-state">
              {context.platformAdmin
                ? <>There are no woredas yet. Load Ethiopia&apos;s regions, zones and woredas in <Link className="text-link" href="/organization">Clusters & hierarchy</Link> first.</>
                : "You do not administer a woreda (or a zone or region above one), so you cannot add clusters. Ask the woreda or super administrator."}
            </p>
          ) : (
            <RecordForm action={addCluster} pendingLabel="Creating…" submitLabel="Create cluster" fields={[
              { name: "woredaId", label: "Woreda", type: "select", required: true, defaultValue: preset, options: woredas, wide: true },
              { name: "name", label: "Cluster name", required: true, max: 160, placeholder: "Genet cluster" },
              { name: "code", label: "Cluster code", max: 40 },
              { name: "description", label: "Description", max: 500, wide: true },
              { name: "schools", label: "Schools in the cluster (one name per line)", type: "textarea", max: 40_000, placeholder: "ገነት\nቪክትሪ\nመልዕክት" },
            ]} />
          )}
        </section>
        <section className="management-card">
          <h2>Many clusters at once</h2>
          <p className="management-description">Import clusters with their schools from a CSV file (region, zone, woreda, cluster, school_name, school_code, kebele) on <Link className="text-link" href="/organization">Clusters & hierarchy</Link>.</p>
        </section>
      </div>
    </main>
  );
}

export default function AddClusterPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading...</p></main>}><AddClusterContent searchParams={searchParams} /></Suspense>;
}
