// Vercel build: migrate + seed a real database when DATABASE_URL is set, then build.
// Without DATABASE_URL the app runs in the temporary in-memory demo mode (src/server/memory-db.ts).
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const url = process.env.DATABASE_URL?.trim();
if (url && url !== "memory") {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
} else {
  console.log("DATABASE_URL is not set: skipping migrations (in-memory demo mode).");
}
run("npx next build");
