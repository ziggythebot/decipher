import { defineConfig, env } from "prisma/config";
import { config } from "dotenv";
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use unpooled connection for migrations (DDL requires advisory locks).
    // Use pooled connection (DATABASE_URL) for runtime queries.
    url: env("DATABASE_URL_UNPOOLED") || env("DATABASE_URL"),
  },
});
