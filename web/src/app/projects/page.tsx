import { projects } from "@/lib/data";
import { ProjectsList } from "./ProjectsList";

export default function ProjectsPage() {
  const active = projects.filter((p) => !p.archived);
  const archived = projects.length - active.length;
  return <ProjectsList initial={active} archivedCount={archived} />;
}
