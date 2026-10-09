import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  basePath,
  trailingSlash: staticExport,
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
};

export default nextConfig;
