import { mockStaticParams } from "@/lib/backend/mock";

export function generateStaticParams({ params }: { params: { projectId: string; versionId: string } }) {
  if (process.env.STATIC_EXPORT !== "1") return [];
  const version = mockStaticParams()
    .find((p) => p.projectId === params.projectId)
    ?.versions.find((v) => v.versionId === params.versionId);
  return [...(version?.steps ?? []), "new"].map((stepId) => ({ stepId }));
}

export default function StepLayout({ children }: { children: React.ReactNode }) {
  return children;
}
