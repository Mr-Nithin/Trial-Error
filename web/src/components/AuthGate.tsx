"use client";

import { useMe } from "@/lib/hooks";
import { Loading } from "./ui";

/** Renders children once the session is confirmed; 401s are redirected by Providers. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data, error } = useMe();
  if (data) return children;
  if (error) return <Loading label="Redirecting to log in…" />;
  return <Loading />;
}
