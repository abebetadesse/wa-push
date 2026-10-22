import type { Metadata } from "next";
import { Suspense } from "react";
import { FacilityContent, type FacilitySearchParams } from "../facilities/facility-page";

export const metadata: Metadata = { title: "Laboratories | Forma" };

export default function LabPage({ searchParams }: { searchParams: FacilitySearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading laboratories...</p></main>}><FacilityContent kind="lab" searchParams={searchParams} /></Suspense>;
}
