import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Bucket, getR2Client } from "@/app/lib/r2/client";
import { Readable } from "stream";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";

export async function putObject(opts: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/** Returns true if the object exists in R2. */
export async function objectExists(key: string): Promise<boolean> {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    return true;
  } catch (e: unknown) {
    const code = (e as { name?: string })?.name;
    if (code === "NotFound" || code === "NoSuchKey") return false;
    throw e;
  }
}

export async function getObjectReadUrl(key: string, ttlSeconds = 60 * 10) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  return await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), {
    expiresIn: ttlSeconds,
  });
}

export async function getObjectStream(key: string) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  if (!res.Body) throw new Error("Missing body");
  return res.Body; // ReadableStream/Node stream depending on runtime
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  // Node stream
  if (body && typeof (body as { pipe?: unknown }).pipe === "function") {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      (body as NodeJS.ReadableStream)
        .on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        .on("end", () => resolve())
        .on("error", (e) => reject(e));
    });
    return Buffer.concat(chunks);
  }

  // Web ReadableStream
  if (body && typeof (body as { getReader?: unknown }).getReader === "function") {
    const rs = body as ReadableStream<Uint8Array>;
    if (typeof Readable.fromWeb === "function") {
      return await streamToBuffer(Readable.fromWeb(rs as unknown as NodeWebReadableStream));
    }
    const reader = rs.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return Buffer.from(out);
  }

  // Already bytes
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body));

  throw new Error("Unsupported body type");
}

export async function getObjectBytes(key: string) {
  const body = await getObjectStream(key);
  return await streamToBuffer(body);
}


