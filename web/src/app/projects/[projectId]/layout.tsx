import { mockStaticParams } from "@/lib/backend/mock";

export function generateStaticParams() {
  return process.env.STATIC_EXPORT === "1" ? mockStaticParams().map(({ projectId }) => ({ projectId })) : [];
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
