"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { GateScreen } from "@/components/ProjectGate";
import { Loading } from "@/components/ui";
import { useProjectPage } from "@/lib/hooks";
import { BranchPicker } from "./BranchPicker";

function BranchScreen() {
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const { data, gate, mutate } = useProjectPage(projectId);
  if (gate) return <GateScreen gate={gate} onRetry={() => mutate()} />;
  const version = data!.versions.find((v) => v.id === versionId);
  if (!version) return <GateScreen gate={{ message: "This version doesn’t exist, or it was deleted." }} />;
  return <BranchPicker project={data!} version={version} />;
}

export default function BranchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BranchScreen />
    </Suspense>
  );
}
