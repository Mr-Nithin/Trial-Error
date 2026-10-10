import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/client.js";
import { createS3, ensureBucket } from "./lib/s3.js";
import { purgeExpiredSessions } from "./lib/session.js";

async function main() {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  const s3 = createS3(config);

  await runMigrations(db);
  await ensureBucket(s3, config.S3_BUCKET);
  await purgeExpiredSessions(db);

  const app = await buildApp({ config, db, s3 });
  app.addHook("onClose", async () => {
    await pool.end();
    s3.destroy();
  });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "shutting down");
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
