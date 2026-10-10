import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import { branchSchema, idParams, updateVersionSchema } from "../lib/schemas.js";
import { currentUser } from "../plugins/auth.js";
import { branchVersion, deleteVersion, duplicateVersion, getVersion, updateVersion } from "../services/versions.js";

const versionRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get("/versions/:id", { schema: { params: idParams } }, async (req) =>
    getVersion(db, currentUser(req).id, req.params.id),
  );

  app.patch("/versions/:id", { schema: { params: idParams, body: updateVersionSchema } }, async (req) =>
    updateVersion(db, currentUser(req).id, req.params.id, req.body),
  );

  app.delete("/versions/:id", { schema: { params: idParams } }, async (req, reply) => {
    await deleteVersion(db, currentUser(req).id, req.params.id);
    return reply.code(204).send();
  });

  app.post("/versions/:id/duplicate", { schema: { params: idParams } }, async (req, reply) =>
    reply.code(201).send(await duplicateVersion(db, currentUser(req).id, req.params.id)),
  );

  app.post("/versions/:id/branch", { schema: { params: idParams, body: branchSchema } }, async (req, reply) =>
    reply.code(201).send(await branchVersion(db, currentUser(req).id, req.params.id, req.body)),
  );
};

export default versionRoutes;
