import "server-only";
import { z } from "zod";
import type { AIEmployee, AIEmployeeResponsibility, Company } from "@prisma/client";
import type { TenantDb } from "../db";
import { callAI } from "../ai/runtime";
import { buildPlannerSystemPrompt } from "./prompts";

export const planSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z
    .array(z.object({ employeeId: z.string(), title: z.string().min(1).max(200), instructions: z.string().min(1).max(4000) }))
    .min(1)
    .max(5),
});
export type Plan = z.infer<typeof planSchema>;

type Emp = AIEmployee & { responsibilities: Pick<AIEmployeeResponsibility, "label">[] };

/** Extracts the first JSON object from a model reply (tolerates code fences / stray prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in planner output");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function fallbackPlan(request: string, employees: Emp[]): Plan {
  const pick =
    employees.find((e) => e.templateKey === "ceo_assistant") ??
    employees.find((e) => e.department === "Executive") ??
    employees[0];
  return {
    title: request.slice(0, 60),
    steps: [{ employeeId: pick.id, title: request.slice(0, 120), instructions: request }],
  };
}

/** Validates a plan against the company's roster; unknown ids are dropped. */
export function sanitizePlan(plan: Plan, employees: Emp[]): Plan | null {
  const ids = new Set(employees.map((e) => e.id));
  const steps = plan.steps.filter((s) => ids.has(s.employeeId));
  return steps.length ? { title: plan.title, steps } : null;
}

export async function planWorkflow(
  db: TenantDb,
  input: { company: Company; request: string; employees: Emp[]; userId?: string | null },
): Promise<Plan> {
  const { company, request, employees } = input;
  if (employees.length === 1) {
    return { title: request.slice(0, 60), steps: [{ employeeId: employees[0].id, title: request.slice(0, 120), instructions: request }] };
  }
  const roster = employees
    .map((e) => `- id: ${e.id}\n  name: ${e.name}\n  role: ${e.role} (${e.department})\n  mission: ${e.mission}\n  responsibilities: ${e.responsibilities.map((r) => r.label).join(", ") || "-"}`)
    .join("\n");
  const res = await callAI(
    db,
    { companyId: company.id, purpose: "plan", userId: input.userId },
    {
      system: buildPlannerSystemPrompt(company),
      messages: [{ role: "user", content: `## AI employees\n${roster}\n\n## Request from the user\n${request}` }],
      maxTokens: 4000,
      json: true,
    },
  );
  try {
    const parsed = planSchema.parse(extractJson(res.text));
    return sanitizePlan(parsed, employees) ?? fallbackPlan(request, employees);
  } catch {
    return fallbackPlan(request, employees);
  }
}
