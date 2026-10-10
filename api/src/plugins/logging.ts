import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import fp from "fastify-plugin";
import type { FastifyServerOptions } from "fastify";

/** Paths pino replaces with "[redacted]" wherever they appear in a log line. */
export const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  "headers.cookie",
  "headers.authorization",
  "body.password",
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
];

const INCOMING_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Reuse a well-formed upstream x-request-id (e.g. from the web proxy), else mint one. */
export function genReqId(req: IncomingMessage): string {
  const incoming = req.headers["x-request-id"];
  return typeof incoming === "string" && INCOMING_ID.test(incoming) ? incoming : randomUUID();
}

export function loggerOptions(level: string, enabled: boolean): FastifyServerOptions["logger"] {
  if (!enabled) return false;
  return { level, redact: { paths: REDACT_PATHS, censor: "[redacted]" } };
}

/** Echo the request id back so clients/proxies can correlate logs. */
export const requestLogging = fp(
  async (app) => {
    app.addHook("onSend", async (request, reply) => {
      reply.header("x-request-id", request.id);
    });
  },
  { name: "arc-request-logging" },
);
