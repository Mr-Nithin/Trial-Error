import { loadConfig } from "../src/config.js";
import { createDb, runMigrations } from "../src/db/client.js";
import { testEnv } from "./env.js";
import { createS3, ensureBucket } from "../src/lib/s3.js";

export default async function setup() {
  const config = loadConfig({ ...process.env, ...testEnv });
  if (!/_test\b/.test(config.DATABASE_URL)) {
    throw new Error(`Refusing to run tests against non-test database: ${config.DATABASE_URL}`);
  }
  const { db, pool } = createDb(config.DATABASE_URL, 2);
  try {
    await runMigrations(db);
  } finally {
    await pool.end();
  }
  const s3 = createS3(config);
  await ensureBucket(s3, config.S3_BUCKET);
  s3.destroy();
}
