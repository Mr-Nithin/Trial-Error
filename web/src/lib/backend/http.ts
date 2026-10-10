import type { ApiErrorBody } from "@shared/api-types";
import { ApiError, type Backend } from "./types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin", headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, "network", "Can’t reach Arc right now. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const del = (path: string) => request<void>("DELETE", path);

export const httpBackend: Backend = {
  me: () => get("/auth/me"),
  signup: (input) => post("/auth/signup", input),
  login: (input) => post("/auth/login", input),
  logout: () => request("POST", "/auth/logout"),
  updateMe: (input) => patch("/auth/me", input),

  listProjects: (archived) => get(`/projects?archived=${archived}`),
  getProject: (id) => get(`/projects/${encodeURIComponent(id)}`),
  createProject: (input) => post("/projects", input),
  updateProject: (id, input) => patch(`/projects/${id}`, input),
  deleteProject: (id) => del(`/projects/${id}`),
  duplicateProject: (id) => post(`/projects/${id}/duplicate`),
  replaceGoals: (id, input) => put(`/projects/${id}/goals`, input),

  createVersion: (projectId, input) => post(`/projects/${projectId}/versions`, input),
  updateVersion: (id, input) => patch(`/versions/${id}`, input),
  deleteVersion: (id) => del(`/versions/${id}`),
  duplicateVersion: (id) => post(`/versions/${id}/duplicate`),
  branchVersion: (id, input) => post(`/versions/${id}/branch`, input),

  createStep: (versionId, input) => post(`/versions/${versionId}/steps`, input),
  updateStep: (id, input) => patch(`/steps/${id}`, input),
  deleteStep: (id) => del(`/steps/${id}`),
  moveStep: (id, input) => post(`/steps/${id}/move`, input),

  createRun: (versionId, input) => post(`/versions/${versionId}/runs`, input),
  uploadMedia: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("POST", "/media", form);
  },
};
