import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const staticExport = process.env.STATIC_EXPORT === "1";
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  basePath,
  trailingSlash: staticExport,
  ...(staticExport
    ? {}
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
        },
      }),
};

export default nextConfig;
