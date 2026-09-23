/* Global catalog data: AI employee templates, plans, model prices. Idempotent. */
import type { PrismaClient } from "@prisma/client";
import { EMPLOYEE_TEMPLATES, responsibilityInfo } from "../src/lib/catalog";

// Plans are data, not code: edit prices/limits here or directly in the DB. Prices left null until launch.
const PLANS = [
  { key: "free", name: "Free", description: "自分の API キーで始める (BYOK)", monthlyPriceCents: 0, maxEmployees: 5, allowsPlatformAI: false, sortOrder: 0 },
  { key: "starter", name: "Starter", description: "小さなチーム向け", monthlyPriceCents: null, maxEmployees: 15, allowsPlatformAI: false, sortOrder: 1 },
  { key: "pro", name: "Pro", description: "AI 利用料込みのプラン", monthlyPriceCents: null, maxEmployees: 50, allowsPlatformAI: true, sortOrder: 2 },
  { key: "business", name: "Business", description: "複数部門・高い利用量", monthlyPriceCents: null, maxEmployees: 200, allowsPlatformAI: true, sortOrder: 3 },
  { key: "enterprise", name: "Enterprise", description: "個別契約・SLA", monthlyPriceCents: null, maxEmployees: null, allowsPlatformAI: true, isPublic: false, sortOrder: 4 },
];

// micro-USD per 1M tokens (Anthropic first-party list prices). Unknown models record cost 0.
const MODEL_PRICES = [
  { provider: "anthropic", model: "claude-opus-5", input: 5_000_000, output: 25_000_000 },
  { provider: "anthropic", model: "claude-sonnet-5", input: 2_000_000, output: 10_000_000 },
  { provider: "anthropic", model: "claude-haiku-4-5", input: 1_000_000, output: 5_000_000 },
];

export async function seedCatalog(prisma: PrismaClient) {
  for (const [i, t] of EMPLOYEE_TEMPLATES.entries()) {
    const data = {
      name: t.name,
      department: t.department,
      description: t.description,
      recommendedUse: t.recommendedUse,
      defaultMission: t.defaultMission,
      responsibilities: t.responsibilities.map((k) => ({ key: k, label: responsibilityInfo(k)?.ja ?? k, default: t.defaultResponsibilities.includes(k) })),
      suggestedTools: t.suggestedTools,
      sortOrder: i,
    };
    await prisma.employeeTemplate.upsert({ where: { key: t.key }, create: { key: t.key, ...data }, update: data });
  }
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { key: p.key }, create: p, update: p });
  }
  for (const m of MODEL_PRICES) {
    await prisma.modelPrice.upsert({
      where: { provider_model: { provider: m.provider, model: m.model } },
      create: { provider: m.provider, model: m.model, inputPerMTokMicroUsd: m.input, outputPerMTokMicroUsd: m.output },
      update: { inputPerMTokMicroUsd: m.input, outputPerMTokMicroUsd: m.output },
    });
  }
  return { templates: EMPLOYEE_TEMPLATES.length, plans: PLANS.length, prices: MODEL_PRICES.length };
}
