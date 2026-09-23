import "server-only";
import type { AIProvider } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { geminiProvider } from "./providers/gemini";

const providers = new Map<string, AIProvider>([
  [anthropicProvider.id, anthropicProvider],
  [openaiProvider.id, openaiProvider],
  [geminiProvider.id, geminiProvider],
]);

export function getAIProvider(id: string): AIProvider | undefined {
  return providers.get(id);
}

/** Register an additional provider (new vendors, or a scripted provider in tests). */
export function registerAIProvider(p: AIProvider): void {
  providers.set(p.id, p);
}

/** Preference order when a company has several AI providers connected. */
export const PROVIDER_PREFERENCE = ["anthropic", "openai", "gemini"];
