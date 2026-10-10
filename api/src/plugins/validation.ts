import fp from "fastify-plugin";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";

/**
 * zod validation for params/query/body via fastify-type-provider-zod, plus a JSON parser that
 * treats an empty body as "no body" (so `POST /logout` with a JSON content-type still works).
 */
export const zodValidation = fp(
  async (app) => {
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.removeContentTypeParser("application/json");
    app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, raw, done) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      if (text.trim() === "") return done(null, undefined);
      try {
        // Reviver drops prototype-poisoning keys.
        done(null, JSON.parse(text, (k, v) => (k === "__proto__" ? undefined : v)));
      } catch {
        done(new ApiError(400, "invalid_json", "Request body is not valid JSON"), undefined);
      }
    });
  },
  { name: "arc-zod-validation" },
);
