import "server-only";
import type { TenantDb } from "../db";
import { clampPolicy, type Policy, type ToolInfo } from "@/lib/tool-catalog";
import { allTools, type RegisteredTool } from "./registry";

export interface EmployeeAccessProfile {
  employeeId: string;
  /** Providers granted to this employee (EmployeeConnectionAccess). */
  grantedProviders: Set<string>;
  /** Providers connected for the company. */
  connectedProviders: Set<string>;
  /** Explicit per-tool policies. */
  policies: Map<string, Policy>;
}

export async function loadAccessProfile(db: TenantDb, companyId: string, employeeId: string): Promise<EmployeeAccessProfile> {
  const [access, integrations, perms] = await Promise.all([
    db.employeeConnectionAccess.findMany({ where: { companyId, employeeId }, select: { provider: true } }),
    db.integration.findMany({ where: { companyId, status: "CONNECTED" }, select: { provider: true } }),
    db.employeeToolPermission.findMany({ where: { companyId, employeeId }, select: { tool: true, policy: true } }),
  ]);
  return {
    employeeId,
    grantedProviders: new Set(access.map((a) => a.provider)),
    connectedProviders: new Set(integrations.map((i) => i.provider)),
    policies: new Map(perms.map((p) => [p.tool, p.policy as Policy])),
  };
}

export function effectivePolicy(profile: EmployeeAccessProfile, tool: ToolInfo): Policy {
  return clampPolicy(tool, profile.policies.get(tool.name) ?? tool.defaultPolicy);
}

export type AccessDecision =
  | { allowed: false; reason: string }
  | { allowed: true; requiresApproval: boolean; policy: Policy };

/**
 * Server-side permission gate, evaluated before every tool execution regardless of what the model asked.
 */
export function checkToolAccess(profile: EmployeeAccessProfile, tool: ToolInfo): AccessDecision {
  if (!tool.available) return { allowed: false, reason: `${tool.label} はまだ利用できません` };
  if (tool.provider !== "builtin") {
    if (!profile.connectedProviders.has(tool.provider)) return { allowed: false, reason: `${tool.provider} が接続されていません` };
    if (!profile.grantedProviders.has(tool.provider)) return { allowed: false, reason: `この社員には ${tool.provider} へのアクセス権がありません` };
  }
  const policy = effectivePolicy(profile, tool);
  if (policy === "DENY") return { allowed: false, reason: `${tool.label} はこの社員に禁止されています` };
  return { allowed: true, requiresApproval: policy === "REQUIRE_APPROVAL", policy };
}

/** isApprovalRequired(tool, employee, company) — see docs/architecture.md §8. */
export function isApprovalRequired(profile: EmployeeAccessProfile, tool: ToolInfo): boolean {
  const d = checkToolAccess(profile, tool);
  return d.allowed && d.requiresApproval;
}

/** Tools offered to the model for this employee (denied/unavailable ones are not even shown). */
export function toolsForEmployee(profile: EmployeeAccessProfile): (RegisteredTool & { requiresApproval: boolean })[] {
  return allTools().flatMap((t) => {
    const d = checkToolAccess(profile, t.info);
    return d.allowed ? [{ ...t, requiresApproval: d.requiresApproval }] : [];
  });
}
