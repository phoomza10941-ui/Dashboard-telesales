// Lightweight liveness probe for Railway's healthcheck. No auth, no external
// calls — just confirms the Node server is up and serving.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
