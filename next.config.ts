import type { NextConfig } from "next";

const KNOWLEDGE_GLOB = ["./content/product-knowledge/**/*"];

const nextConfig: NextConfig = {
  // Ship the product-knowledge markdown vault into the serverless functions that
  // read it at runtime (read via fs in lib/knowledge.ts).
  outputFileTracingIncludes: {
    "/api/customer/analyze": KNOWLEDGE_GLOB,
    "/api/supervisor/bot-config": KNOWLEDGE_GLOB,
    "/api/supervisor/product-knowledge": KNOWLEDGE_GLOB,
    "/api/supervisor/bot-test": KNOWLEDGE_GLOB,
    "/api/call-summary/generate": KNOWLEDGE_GLOB,
  },
};

export default nextConfig;
