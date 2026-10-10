"use client";

import { useParams } from "next/navigation";
import { GateScreen } from "@/components/ProjectGate";
import { useProjectPage } from "@/lib/hooks";
import { StepsList } from "./StepsList";

export default function VersionPage() {
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const { data, gate, mutate } = useProjectPage(projectId);
  if (gate) return <GateScreen gate={gate} onRetry={() => mutate()} />;
  const version = data!.versions.find((v) => v.id === versionId);
  if (!version) return <GateScreen gate={{ message: "This version doesn’t exist, or it was deleted." }} />;
  return <StepsList project={data!} version={version} />;
}
