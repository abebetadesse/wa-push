import type { Metadata } from "next";
import { Suspense } from "react";
import { FacilityContent, type FacilitySearchParams } from "../facilities/facility-page";

export const metadata: Metadata = { title: "Workshops | Forma" };

export default function WorkshopPage({ searchParams }: { searchParams: FacilitySearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading workshops...</p></main>}><FacilityContent kind="workshop" searchParams={searchParams} /></Suspense>;
}
