import { AuthGate } from "@/components/AuthGate";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
