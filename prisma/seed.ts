/* npm run db:seed — seeds global catalog data. Idempotent. */
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "./seed-data";

const prisma = new PrismaClient();

seedCatalog(prisma)
  .then((r) => console.log(`Seeded ${r.templates} employee templates, ${r.plans} plans, ${r.prices} model prices.`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
