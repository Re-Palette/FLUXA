import "server-only";
import { z } from "zod";
import { toolInfo, type ToolInfo } from "@/lib/tool-catalog";
import type { ToolImpl } from "./types";
import { memorySave, memorySearch, reportCreate } from "./builtin";
import {
  calendarCreateEvent,
  calendarListEvents,
  driveCreateDocument,
  driveRead,
  driveSearch,
  gmailCreateDraft,
  gmailSend,
  sheetsRead,
} from "./google";
import { githubCreateIssue, githubListIssues, notionReadPage, notionSearch, slackPostMessage } from "./productivity";

const impls: ToolImpl[] = [
  reportCreate,
  memorySearch,
  memorySave,
  driveSearch,
  driveRead,
  driveCreateDocument,
  sheetsRead,
  gmailCreateDraft,
  gmailSend,
  calendarListEvents,
  calendarCreateEvent,
  notionSearch,
  notionReadPage,
  slackPostMessage,
  githubListIssues,
  githubCreateIssue,
] as ToolImpl[];

export interface RegisteredTool {
  info: ToolInfo;
  impl: ToolImpl;
  jsonSchema: Record<string, unknown>;
}

const registry = new Map<string, RegisteredTool>();
for (const impl of impls) {
  const info = toolInfo(impl.name);
  if (!info) throw new Error(`Tool ${impl.name} missing from tool catalog`);
  const jsonSchema = z.toJSONSchema(impl.input, { io: "input" }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  registry.set(impl.name, { info, impl, jsonSchema });
}

export function getTool(name: string): RegisteredTool | undefined {
  return registry.get(name);
}

export function allTools(): RegisteredTool[] {
  return [...registry.values()];
}
