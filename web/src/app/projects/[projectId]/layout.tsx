import { projectParams } from "@/lib/data";

export function generateStaticParams() {
  return projectParams();
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
