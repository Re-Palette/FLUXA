import "server-only";
import { z } from "zod";
import type { TenantDb } from "../db";
import { decryptSecret, encryptSecret, secretHint } from "../security/crypto";

const apiKeyPayload = z.object({ kind: z.literal("api_key"), apiKey: z.string() });
const oauthPayload = z.object({
  kind: z.literal("oauth"),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number(), // epoch ms
  scope: z.string().optional(),
});
const payloadSchema = z.discriminatedUnion("kind", [apiKeyPayload, oauthPayload]);
export type CredentialPayload = z.infer<typeof payloadSchema>;
export type OAuthPayload = z.infer<typeof oauthPayload>;

const aad = (companyId: string, integrationId: string) => `${companyId}:${integrationId}`;

async function upsertIntegration(
  db: TenantDb,
  companyId: string,
  provider: string,
  data: { accountLabel?: string | null; secretHint?: string | null; scopes?: string[]; userId?: string },
) {
  return db.integration.upsert({
    where: { companyId_provider: { companyId, provider } },
    create: {
      companyId,
      provider,
      status: "CONNECTED",
      accountLabel: data.accountLabel ?? null,
      secretHint: data.secretHint ?? null,
      scopes: data.scopes ?? [],
      connectedAt: new Date(),
      lastCheckedAt: new Date(),
      connectedById: data.userId,
    },
    update: {
      status: "CONNECTED",
      accountLabel: data.accountLabel ?? null,
      secretHint: data.secretHint ?? null,
      scopes: data.scopes ?? [],
      lastError: null,
      connectedAt: new Date(),
      lastCheckedAt: new Date(),
      connectedById: data.userId,
    },
  });
}

async function writeCredential(db: TenantDb, companyId: string, integrationId: string, payload: CredentialPayload) {
  const { ciphertext, keyVersion } = encryptSecret(JSON.stringify(payload), aad(companyId, integrationId));
  const type = payload.kind === "api_key" ? "API_KEY" : "OAUTH";
  const expiresAt = payload.kind === "oauth" ? new Date(payload.expiresAt) : null;
  await db.credential.upsert({
    where: { integrationId },
    create: { companyId, integrationId, type, ciphertext, keyVersion, expiresAt },
    update: { type, ciphertext, keyVersion, expiresAt },
  });
}

export async function storeApiKey(
  db: TenantDb,
  companyId: string,
  provider: string,
  apiKey: string,
  opts: { accountLabel?: string | null; userId?: string } = {},
) {
  const integration = await upsertIntegration(db, companyId, provider, {
    accountLabel: opts.accountLabel,
    secretHint: secretHint(apiKey),
    userId: opts.userId,
  });
  await writeCredential(db, companyId, integration.id, { kind: "api_key", apiKey });
  return integration;
}

export async function storeOAuthTokens(
  db: TenantDb,
  companyId: string,
  provider: string,
  tokens: Omit<OAuthPayload, "kind">,
  opts: { accountLabel?: string | null; scopes: string[]; userId?: string },
) {
  const integration = await upsertIntegration(db, companyId, provider, {
    accountLabel: opts.accountLabel,
    scopes: opts.scopes,
    userId: opts.userId,
  });
  await writeCredential(db, companyId, integration.id, { kind: "oauth", ...tokens });
  return integration;
}

/** Decrypts a credential for server-side use only. Never return the result to the client. */
export async function loadCredential(db: TenantDb, companyId: string, provider: string) {
  const integration = await db.integration.findUnique({
    where: { companyId_provider: { companyId, provider } },
    include: { credential: true },
  });
  if (!integration || integration.status === "DISCONNECTED" || !integration.credential) return null;
  const plaintext = decryptSecret(integration.credential.ciphertext, aad(companyId, integration.id));
  return { integration, payload: payloadSchema.parse(JSON.parse(plaintext)) };
}

export async function updateOAuthPayload(db: TenantDb, companyId: string, integrationId: string, payload: OAuthPayload) {
  await writeCredential(db, companyId, integrationId, payload);
}

export async function removeCredential(db: TenantDb, companyId: string, provider: string) {
  const integration = await db.integration.findUnique({ where: { companyId_provider: { companyId, provider } } });
  if (!integration) return null;
  await db.credential.deleteMany({ where: { integrationId: integration.id } });
  return db.integration.update({
    where: { id: integration.id },
    data: { status: "DISCONNECTED", secretHint: null, accountLabel: null, scopes: [], lastError: null },
  });
}
