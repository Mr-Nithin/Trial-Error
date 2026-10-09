import { getProject } from "@/lib/data";

export function generateStaticParams({ params }: { params: { projectId: string } }) {
  return (getProject(params.projectId)?.versions ?? []).map((v) => ({ versionId: v.id }));
}

export default function VersionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
