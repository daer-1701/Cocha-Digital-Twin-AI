import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  agentRules: false,
  transpilePackages: ["@cocha/shared"],
  outputFileTracingIncludes: {
    "/*": ["./public/pilot-analysis/**/*"],
  },
};

export default config;
