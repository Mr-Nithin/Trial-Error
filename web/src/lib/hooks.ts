"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import { backend } from "./backend";
import { toProject, toSummary } from "./mappers";

export const keys = {
  me: "me",
  projects: (archived: boolean) => `projects:${archived}`,
  project: (id: string) => `project:${id}`,
};

export function useMe() {
  return useSWR(keys.me, () => backend.me(), { shouldRetryOnError: false, revalidateOnFocus: false });
}

export function useProjects(archived = false) {
  const res = useSWR(keys.projects(archived), () => backend.listProjects(archived));
  const data = useMemo(() => res.data?.map(toSummary), [res.data]);
  return { ...res, data };
}

export function useProject(id: string | undefined) {
  const res = useSWR(id ? keys.project(id) : null, () => backend.getProject(id!));
  const data = useMemo(() => (res.data ? toProject(res.data) : undefined), [res.data]);
  return { ...res, data, raw: res.data };
}

/** Revalidate every cached query that could show this project. */
export function refreshProject(id?: string) {
  return mutate((key) => typeof key === "string" && (key.startsWith("projects:") || (id ? key === keys.project(id) : key.startsWith("project:"))));
}

export function clearSession() {
  return mutate(() => true, undefined, { revalidate: false });
}

/** Loads the project for the current route; `gate` is a loading/error screen to render instead, if any. */
export function useProjectPage(projectId: string | undefined) {
  const res = useProject(projectId);
  let gate: "loading" | { message: string; notFound?: boolean } | null = null;
  if (res.error) {
    const status = (res.error as { status?: number }).status;
    gate = status === 404 ? { message: "This project doesn’t exist, or it was deleted.", notFound: true } : { message: (res.error as Error).message };
  } else if (!res.data) {
    gate = "loading";
  }
  return { ...res, gate };
}
