import { Suspense } from "react";
import { NewProjectForm } from "./NewProjectForm";

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectForm />
    </Suspense>
  );
}
