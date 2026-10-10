import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import multipart from "@fastify/multipart";
import type { S3Client } from "@aws-sdk/client-s3";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import { media } from "../db/schema.js";
import { toMediaDTO } from "../lib/dto.js";
import { ApiError, badRequest, notFound } from "../lib/errors.js";
import { loadOwnedMedia } from "../lib/ownership.js";
import { deleteObject, getObjectStream, putObjectStream } from "../lib/s3.js";
import { idParams } from "../lib/schemas.js";
import { currentUser } from "../plugins/auth.js";

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

// image/* or video/*; SVG is excluded because it can carry script when opened directly.
const ALLOWED = /^(image|video)\/[a-z0-9][a-z0-9.+-]*$/;
const isAllowedType = (ct: string) => ALLOWED.test(ct) && ct !== "image/svg+xml";

const tooLarge = () => new ApiError(413, "payload_too_large", "File exceeds the 25 MB limit");

export interface MediaRouteOptions {
  db: Db;
  s3: S3Client;
  bucket: string;
}

const mediaRoutes: FastifyPluginAsyncZod<MediaRouteOptions> = async (app, { db, s3, bucket }) => {
  // Scoped to this plugin: only /media accepts multipart.
  await app.register(multipart, {
    limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 10, parts: 12 },
  });

  app.post("/media", { config: { allowMultipart: true } }, async (req, reply) => {
    const user = currentUser(req);
    if (!req.isMultipart()) throw new ApiError(415, "unsupported_media_type", "Expected multipart/form-data");
    const file = await req.file();
    if (!file || file.fieldname !== "file") {
      file?.file.resume();
      throw badRequest("missing_file", 'Expected a single file in the "file" field');
    }
    const contentType = file.mimetype.trim().toLowerCase();
    if (!isAllowedType(contentType)) {
      file.file.resume();
      throw badRequest("unsupported_media", "Only image and video uploads are allowed");
    }

    const id = randomUUID();
    const key = `${user.id}/${id}`;
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        cb(null, chunk);
      },
    });

    try {
      await Promise.all([pipeline(file.file, counter), putObjectStream(s3, bucket, key, counter, contentType)]);
    } catch (err) {
      await deleteObject(s3, bucket, key).catch(() => undefined);
      if (file.file.truncated || (err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") throw tooLarge();
      throw err;
    }
    if (file.file.truncated) {
      await deleteObject(s3, bucket, key).catch(() => undefined);
      throw tooLarge();
    }

    const [row] = await db.insert(media).values({ id, userId: user.id, objectKey: key, contentType, size }).returning();
    return reply.code(201).send(toMediaDTO(row!));
  });

  app.get("/media/:id", { schema: { params: idParams } }, async (req, reply) => {
    const row = await loadOwnedMedia(db, currentUser(req).id, req.params.id);
    let body;
    try {
      body = await getObjectStream(s3, bucket, row.objectKey);
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") throw notFound("Media");
      throw err;
    }
    return reply
      .header("content-type", row.contentType)
      .header("content-length", String(row.size))
      .header("cache-control", "private, max-age=31536000, immutable")
      .send(body);
  });
};

export default mediaRoutes;
