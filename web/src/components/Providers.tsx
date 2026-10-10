"use client";

import { usePathname, useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import { ApiError } from "@/lib/backend";

const publicPaths = ["/", "/login", "/signup"];

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SWRConfig
      value={{
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401 && !publicPaths.includes(pathname)) {
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          }
        },
        shouldRetryOnError: (err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500),
      }}
    >
      {children}
    </SWRConfig>
  );
}
