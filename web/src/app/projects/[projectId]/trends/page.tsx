"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { GateScreen } from "@/components/ProjectGate";
import { Loading } from "@/components/ui";
import { useProjectPage } from "@/lib/hooks";
import { TrendsView } from "./TrendsView";

function Screen() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, gate, mutate } = useProjectPage(projectId);
  if (gate) return <GateScreen gate={gate} onRetry={() => mutate()} />;
  return <TrendsView project={data!} />;
}

export default function TrendsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Screen />
    </Suspense>
  );
}
