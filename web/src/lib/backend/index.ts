import { httpBackend } from "./http";
import { mockBackend, mockMediaUrl } from "./mock";
import type { Backend } from "./types";

export const isMock = process.env.NEXT_PUBLIC_DATA_MODE === "mock";

export const backend: Backend = isMock ? mockBackend : httpBackend;

export function mediaUrl(id: string): string {
  return isMock ? mockMediaUrl(id) : `/api/media/${id}`;
}

export { ApiError } from "./types";
