import "server-only";
import { z } from "zod";
import { defineTool } from "./types";

export const reportCreate = defineTool({
  name: "report.create",
  description:
    "Save a finished deliverable as a company report. Use for research results, analyses, plans, and summaries the user should keep.",
  input: z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(1000).describe("2-3 sentence executive summary"),
    content: z.string().min(1).max(100_000).describe("Full report body in Markdown"),
  }),
  async execute(ctx, input) {
    const task = await ctx.db.task.findUnique({ where: { id: ctx.taskId }, select: { workflowId: true } });
    const report = await ctx.db.report.create({
      data: {
        companyId: ctx.companyId,
        employeeId: ctx.employee.id,
        taskId: ctx.taskId,
        workflowId: task?.workflowId ?? null,
        title: input.title,
        summary: input.summary,
        content: input.content,
        kind: "task",
      },
    });
    return { content: `Report saved (id: ${report.id}).`, data: { reportId: report.id } };
  },
});

export const memorySearch = defineTool({
  name: "memory.search",
  description: "Search the company's long-term memory (profile, goals, brand guidelines, decisions, past report summaries).",
  input: z.object({ query: z.string().min(1).max(200) }),
  async execute(ctx, input) {
    const terms = input.query.split(/\s+/).filter(Boolean).slice(0, 5);
    const rows = await ctx.db.companyMemory.findMany({
      where: {
        companyId: ctx.companyId,
        OR: terms.flatMap((t) => [
          { title: { contains: t, mode: "insensitive" as const } },
          { content: { contains: t, mode: "insensitive" as const } },
        ]),
      },
      orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
      take: 8,
    });
    if (rows.length === 0) return { content: "No matching memories." };
    return {
      content: rows.map((r) => `### ${r.title} (${r.kind})\n${r.content.slice(0, 2000)}`).join("\n\n"),
      data: { ids: rows.map((r) => r.id) },
    };
  },
});

export const memorySave = defineTool({
  name: "memory.save",
  description: "Record an important finding, decision, or preference in company memory so other employees can use it later.",
  input: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    kind: z.enum(["decision", "note", "preference", "report_summary"]).default("note"),
  }),
  async execute(ctx, input) {
    const m = await ctx.db.companyMemory.create({
      data: { companyId: ctx.companyId, title: input.title, content: input.content, kind: input.kind, source: "employee" },
    });
    return { content: `Saved to company memory (id: ${m.id}).`, data: { memoryId: m.id } };
  },
});
