const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["systeminformation", "@prisma/client"]
  },
  typescript: {
    // Workaround: pnpm hoisting + Prisma 5.22 namespace resolution under strict isolatedModules
    // causes 'Cannot use namespace X as a type' false-positives in Next.js tsc check.
    // Skip type checking at build time; rely on `pnpm typecheck` in CI/dev.
    // Source: AGENTS.md §13.6 PITFALL #12
    ignoreBuildErrors: true
  },
  webpack: (config, { isServer }) => {
    // Workaround for pnpm hoisting issue: webpack cannot resolve `.prisma/client/default`
    // through @prisma/client's require() call. Use resolve.alias with regex to map to absolute path.
    // See AGENTS.md §13.6 PITFALL #14
    const prismaGenerated = path.resolve(__dirname, "node_modules/.prisma/client");
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "^\\.prisma/client/default$": path.join(prismaGenerated, "default.js"),
      "^\\.prisma/client/index$": path.join(prismaGenerated, "index.js"),
      "^\\.prisma/client/edge$": path.join(prismaGenerated, "edge.js"),
      "^\\.prisma/client/wasm$": path.join(prismaGenerated, "wasm.js")
    };
    return config;
  }
};

module.exports = nextConfig;
