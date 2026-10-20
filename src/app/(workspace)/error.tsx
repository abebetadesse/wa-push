"use client";

import { ErrorPanel } from "@/components/error-panel";

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} inShell />;
}
