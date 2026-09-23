import "server-only";
import { headers } from "next/headers";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

/** CSRF guard for custom POST route handlers (Server Actions already check Origin). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) throw new Error("Missing origin");
  if (new URL(origin).host !== host) throw new Error("Cross-origin request rejected");
}
