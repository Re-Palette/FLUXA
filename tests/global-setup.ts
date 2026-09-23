import { execSync } from "node:child_process";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://fluxa:fluxa@localhost:5432/fluxa_test";

export default function setup() {
  execSync("npx prisma migrate reset --force --skip-generate", { stdio: "inherit", env: { ...process.env, DATABASE_URL: TEST_DB, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" } });
}
