import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";
import type { Config } from "../config.js";

export function createS3(config: Config): S3Client {
  return new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: true,
    credentials:
      config.S3_ACCESS_KEY && config.S3_SECRET_KEY
        ? { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }
        : undefined,
  });
}

export async function ensureBucket(s3: S3Client, bucket: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (err as { name?: string }).name;
    if (status !== 404 && name !== "NotFound" && name !== "NoSuchBucket") throw err;
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (createErr) {
      const n = (createErr as { name?: string }).name;
      if (n !== "BucketAlreadyOwnedByYou" && n !== "BucketAlreadyExists") throw createErr;
    }
  }
}

/** Streams a body of unknown length to S3 (multipart under the hood for large files). */
export async function putObjectStream(
  s3: S3Client,
  bucket: string,
  key: string,
  body: Readable,
  contentType: string,
): Promise<void> {
  const upload = new Upload({
    client: s3,
    params: { Bucket: bucket, Key: key, Body: body, ContentType: contentType },
    queueSize: 2,
    partSize: 5 * 1024 * 1024,
  });
  await upload.done();
}

export async function getObjectStream(s3: S3Client, bucket: string, key: string): Promise<Readable> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body as Readable;
}

export async function deleteObject(s3: S3Client, bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
