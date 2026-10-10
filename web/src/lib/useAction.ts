"use client";

import { useCallback, useState } from "react";

/** Runs an async UI action, tracks a busy flag, and reports failures through `report`. */
export function useAction(report: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        return true;
      } catch (err) {
        report(err instanceof Error ? err.message : "Something went wrong");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [report],
  );
  return { run, busy };
}
