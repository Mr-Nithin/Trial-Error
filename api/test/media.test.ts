import { describe, expect, it } from "vitest";
import { breakfastProject, type Client, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

function multipart(filename: string, contentType: string, data: Buffer, field = "file") {
  const boundary = "----arcTestBoundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const upload = (c: Client, filename: string, ct: string, data: Buffer, field?: string) =>
  c.inject({ method: "POST", url: "/api/media", ...multipart(filename, ct, data, field) });

describe("media", () => {
  it("uploads to S3 and streams it back to the owner only", async () => {
    const a = await signedIn(ctx.app);
    const b = await signedIn(ctx.app);
    const bytes = Buffer.from(Array.from({ length: 70_000 }, (_, i) => i % 256));
    const res = await upload(a, "toast.jpg", "image/jpeg", bytes);
    expect(res.statusCode).toBe(201);
    const m = res.json();
    expect(m).toEqual({ id: expect.any(String), url: `/api/media/${m.id}`, contentType: "image/jpeg", size: bytes.length });

    const got = await a.get(m.url);
    expect(got.statusCode).toBe(200);
    expect(got.headers["content-type"]).toBe("image/jpeg");
    expect(got.headers["cache-control"]).toBe("private, max-age=31536000, immutable");
    expect(got.rawPayload.equals(bytes)).toBe(true);

    expect((await b.get(m.url)).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "GET", url: m.url })).statusCode).toBe(401);

    // Attach as a step photo; it survives branching only for inherited steps.
    const p = (await a.post("/api/projects", breakfastProject)).json();
    const v = (await a.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const s1 = (await a.post(`/api/versions/${v.id}/steps`, { title: "Bread", photoMediaId: m.id })).json();
    const s2 = (await a.post(`/api/versions/${v.id}/steps`, { title: "Toast" })).json();
    expect(s1.photoMediaId).toBe(m.id);
    expect((await a.patch(`/api/steps/${s2.id}`, { photoMediaId: m.id })).json().photoMediaId).toBe(m.id);
    const br = (await a.post(`/api/versions/${v.id}/branch`, { fromStepId: s2.id, name: "V2" })).json();
    expect(br.steps.map((s: { photoMediaId: string | null }) => s.photoMediaId)).toEqual([m.id, null]);
    expect((await a.patch(`/api/steps/${s1.id}`, { photoMediaId: null })).json().photoMediaId).toBeNull();
  });

  it("accepts video uploads", async () => {
    const a = await signedIn(ctx.app);
    const res = await upload(a, "run.mp4", "video/mp4", Buffer.from("fake mp4"));
    expect(res.statusCode).toBe(201);
    expect(res.json().contentType).toBe("video/mp4");
  });

  it("rejects non-image/video types and SVG", async () => {
    const a = await signedIn(ctx.app);
    for (const ct of ["text/html", "application/pdf", "image/svg+xml"]) {
      const res = await upload(a, "x", ct, Buffer.from("<html></html>"));
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("unsupported_media");
    }
  });

  it("requires the file field and multipart content type", async () => {
    const a = await signedIn(ctx.app);
    const wrongField = await upload(a, "x.png", "image/png", Buffer.from("x"), "photo");
    expect(wrongField.statusCode).toBe(400);
    expect(wrongField.json().error.code).toBe("missing_file");
    const json = await a.post("/api/media", { file: "x" });
    expect(json.statusCode).toBe(415);
  });

  it("rejects files over 25 MB", async () => {
    const a = await signedIn(ctx.app);
    const res = await upload(a, "big.png", "image/png", Buffer.alloc(25 * 1024 * 1024 + 10, 1));
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe("payload_too_large");
  });
});
