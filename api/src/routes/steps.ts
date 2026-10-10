import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import { createStepSchema, idParams, moveStepSchema, updateStepSchema } from "../lib/schemas.js";
import { currentUser } from "../plugins/auth.js";
import { createStep, deleteStep, moveStep, updateStep } from "../services/steps.js";

const stepRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.post("/versions/:id/steps", { schema: { params: idParams, body: createStepSchema } }, async (req, reply) =>
    reply.code(201).send(await createStep(db, currentUser(req).id, req.params.id, req.body)),
  );

  app.patch("/steps/:id", { schema: { params: idParams, body: updateStepSchema } }, async (req) =>
    updateStep(db, currentUser(req).id, req.params.id, req.body),
  );

  app.delete("/steps/:id", { schema: { params: idParams } }, async (req, reply) => {
    await deleteStep(db, currentUser(req).id, req.params.id);
    return reply.code(204).send();
  });

  app.post("/steps/:id/move", { schema: { params: idParams, body: moveStepSchema } }, async (req) =>
    moveStep(db, currentUser(req).id, req.params.id, req.body),
  );
};

export default stepRoutes;
