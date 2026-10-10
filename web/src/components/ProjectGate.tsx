"use client";

import { ErrorState, Loading } from "./ui";

export function GateScreen({ gate, onRetry }: { gate: "loading" | { message: string; notFound?: boolean }; onRetry?: () => void }) {
  if (gate === "loading") return <Loading />;
  const notFound = gate.notFound ?? !onRetry;
  return <ErrorState title={notFound ? "Not found" : undefined} message={gate.message} onRetry={notFound ? undefined : onRetry} />;
}
