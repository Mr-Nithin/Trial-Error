/** Environment for the test run (applied to workers via vitest `env`, and to global setup). */
export const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://arc:arc@localhost:5432/arc_test",
  S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? "http://127.0.0.1:9000",
  S3_ACCESS_KEY: "test",
  S3_SECRET_KEY: "test",
  S3_REGION: "us-east-1",
  S3_BUCKET: "arc-media-test",
  LOG_LEVEL: "silent",
};
