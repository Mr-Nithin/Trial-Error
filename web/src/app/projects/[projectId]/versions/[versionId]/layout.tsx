import { mockStaticParams } from "@/lib/backend/mock";

export function generateStaticParams({ params }: { params: { projectId: string } }) {
  if (process.env.STATIC_EXPORT !== "1") return [];
  return (mockStaticParams().find((p) => p.projectId === params.projectId)?.versions ?? []).map(({ versionId }) => ({ versionId }));
}

export default function VersionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
