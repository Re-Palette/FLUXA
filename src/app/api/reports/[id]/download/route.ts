import { NextResponse } from "next/server";
import { assertCompany } from "@/server/auth/guards";

/** Markdown export. PDF export can be added here later with the same auth check. */
export async function GET(_req: Request, { params }: RouteContext<"/api/reports/[id]/download">) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await assertCompany();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await ctx.db.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  const filename = `${report.title.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 80) || "report"}.md`;
  return new NextResponse(report.content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "x-content-type-options": "nosniff",
    },
  });
}
