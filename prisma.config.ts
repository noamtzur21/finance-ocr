
// Ensure .env is loaded even when Prisma config is present.
// Prisma skips its own env loading when `prisma.config.ts` exists, so we load it ourselves.
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Keep existing process.env values (e.g. from CLI) as highest priority.
loadEnv({ path: ".env", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
