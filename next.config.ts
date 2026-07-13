import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  async redirects() {
    return [
      {
        source: "/story",
        destination: "/story/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
