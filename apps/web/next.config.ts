import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@cocha/shared"],
};

export default config;
