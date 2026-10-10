import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import {
  createProjectSchema,
  createVersionSchema,
  idParams,
  listProjectsQuery,
  replaceGoalsSchema,
  updateProjectSchema,
} from "../lib/schemas.js";
import { currentUser } from "../plugins/auth.js";
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  replaceGoals,
  updateProject,
} from "../services/projects.js";
import { listProjectSummaries } from "../services/queries.js";
import { listRuns } from "../services/runs.js";
import { createVersion } from "../services/versions.js";

const projectRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get("/projects", { schema: { querystring: listProjectsQuery } }, async (req) =>
    listProjectSummaries(db, currentUser(req).id, req.query.archived),
  );

  app.post("/projects", { schema: { body: createProjectSchema } }, async (req, reply) =>
    reply.code(201).send(await createProject(db, currentUser(req).id, req.body)),
  );

  app.get("/projects/:id", { schema: { params: idParams } }, async (req) =>
    getProject(db, currentUser(req).id, req.params.id),
  );

  app.patch("/projects/:id", { schema: { params: idParams, body: updateProjectSchema } }, async (req) =>
    updateProject(db, currentUser(req).id, req.params.id, req.body),
  );

  app.delete("/projects/:id", { schema: { params: idParams } }, async (req, reply) => {
    await deleteProject(db, currentUser(req).id, req.params.id);
    return reply.code(204).send();
  });

  app.post("/projects/:id/duplicate", { schema: { params: idParams } }, async (req, reply) =>
    reply.code(201).send(await duplicateProject(db, currentUser(req).id, req.params.id)),
  );

  app.put("/projects/:id/goals", { schema: { params: idParams, body: replaceGoalsSchema } }, async (req) =>
    replaceGoals(db, currentUser(req).id, req.params.id, req.body.goals),
  );

  app.post("/projects/:id/versions", { schema: { params: idParams, body: createVersionSchema } }, async (req, reply) =>
    reply.code(201).send(await createVersion(db, currentUser(req).id, req.params.id, req.body)),
  );

  app.get("/projects/:id/runs", { schema: { params: idParams } }, async (req) =>
    listRuns(db, currentUser(req).id, req.params.id),
  );
};

export default projectRoutes;
