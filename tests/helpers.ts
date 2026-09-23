import { prisma, tenantDb } from "@/server/db";
import { createEmployee } from "@/server/services/employees";
import { registerAIProvider } from "@/server/ai/registry";
import { storeApiKey } from "@/server/integrations/vault";
import type { AIProvider, GenerateRequest, GenerateResult } from "@/server/ai/types";

let n = 0;
export async function makeCompany(name = "Co") {
  n++;
  const user = await prisma.user.create({ data: { email: `u${Date.now()}_${n}@test.dev`, name: "Tester" } });
  const company = await prisma.company.create({
    data: { name: `${name} ${n}`, industry: "SaaS", size: "1–10", description: "desc", goal: "goal", status: "ACTIVE" },
  });
  await prisma.companyMember.create({ data: { companyId: company.id, userId: user.id, role: "OWNER" } });
  return { user, company, db: tenantDb(company.id) };
}

export { createEmployee };

type Script = (req: GenerateRequest, call: number) => Partial<GenerateResult>;

/** Replaces the "anthropic" provider with a scripted one and connects it for the company. */
export async function useScriptedAI(companyId: string, script: Script) {
  const calls: GenerateRequest[] = [];
  const provider: AIProvider = {
    id: "anthropic",
    name: "Scripted",
    defaultModel: "claude-opus-5",
    async testConnection() {
      return { ok: true };
    },
    async generate(req) {
      calls.push(req);
      const r = script(req, calls.length);
      return { text: "", toolCalls: [], stopReason: r.toolCalls?.length ? "tool_use" : "end", usage: { inputTokens: 100, outputTokens: 50 }, model: req.model, ...r };
    },
  };
  registerAIProvider(provider);
  await storeApiKey(tenantDb(companyId), companyId, "anthropic", "sk-ant-test-key-000000");
  return calls;
}
