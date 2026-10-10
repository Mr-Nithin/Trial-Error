import fp from "fastify-plugin";
import type { FastifyError } from "fastify";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";
import type { ApiErrorBody } from "../types.js";

const body = (code: string, message: string, details?: unknown): ApiErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

const CODE_BY_STATUS: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  406: "not_acceptable",
  408: "timeout",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
};

/** Every error leaves the API as ApiErrorBody; 5xx never leak internals. */
export const errorHandler = fp(
  async (app) => {
    app.setNotFoundHandler((req, reply) => {
      reply.code(404).send(body("not_found", `Route ${req.method} ${req.url.split("?")[0]} not found`));
    });

    app.setErrorHandler((err: FastifyError | ApiError | Error, req, reply) => {
      if (err instanceof ApiError) {
        if (err.statusCode >= 500) req.log.error({ err }, "api error");
        return reply.code(err.statusCode).send(body(err.code, err.message, err.details));
      }
      if (hasZodFastifySchemaValidationErrors(err)) {
        const details = err.validation.map((v) => ({
          path: v.instancePath || "/",
          message: v.message,
          in: err.validationContext,
        }));
        return reply.code(400).send(body("validation", "Request validation failed", details));
      }
      if (isResponseSerializationError(err)) {
        req.log.error({ err }, "response serialization failed");
        return reply.code(500).send(body("internal", "Internal server error"));
      }
      const fe = err as FastifyError;
      const status = typeof fe.statusCode === "number" ? fe.statusCode : 500;
      if (status >= 400 && status < 500) {
        if (fe.validation) {
          return reply.code(400).send(body("validation", fe.message));
        }
        // Fastify/plugin client errors (bad JSON, too large, wrong content type...): message is safe.
        return reply.code(status).send(body(CODE_BY_STATUS[status] ?? "bad_request", fe.message));
      }
      req.log.error({ err }, "unhandled error");
      return reply.code(500).send(body("internal", "Internal server error"));
    });
  },
  { name: "arc-error-handler" },
);
