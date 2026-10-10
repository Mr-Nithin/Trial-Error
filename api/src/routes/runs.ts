import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import { createRunSchema, idParams } from "../lib/schemas.js";
import { currentUser } from "../plugins/auth.js";
import { createRun } from "../services/runs.js";

// GET /projects/:id/runs lives in routes/projects.ts alongside the other project-scoped reads.
const runRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.post("/versions/:id/runs", { schema: { params: idParams, body: createRunSchema } }, async (req, reply) =>
    reply.code(201).send(await createRun(db, currentUser(req).id, req.params.id, req.body)),
  );
};

export default runRoutes;
