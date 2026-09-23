import "server-only";
import type { z } from "zod";
import type { TenantDb } from "../db";

export interface ToolContext {
  db: TenantDb;
  companyId: string;
  employee: { id: string; name: string; role: string };
  taskId: string;
  workflowId: string | null;
}

export interface ToolOutput {
  /** Text handed back to the model (treated as untrusted data by the agent). */
  content: string;
  /** Structured result stored on the ToolCall row. */
  data?: unknown;
}

export interface ToolImpl<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: S;
  /** Human-readable description of a pending call for the Approval Center. */
  describe?: (input: z.infer<S>) => { title: string; summary: string };
  execute: (ctx: ToolContext, input: z.infer<S>) => Promise<ToolOutput>;
}

export function defineTool<S extends z.ZodType>(t: ToolImpl<S>): ToolImpl<S> {
  return t;
}

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
