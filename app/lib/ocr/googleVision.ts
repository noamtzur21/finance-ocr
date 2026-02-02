import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";

const VISION_REST_URL = "https://vision.googleapis.com/v1/images:annotate";
const VISION_FILES_ASYNC_REST_URL = "https://vision.googleapis.com/v1/files:asyncBatchAnnotate";
const VISION_OPERATIONS_REST_BASE = "https://vision.googleapis.com/v1/";

let cachedClient: ImageAnnotatorClient | null = null;
let cachedStorage: Storage | null = null;
let cachedCreds:
  | null
  | {
      credentials: { client_email: string; private_key: string };
      projectId?: string;
    } = null;

/** Normalize private key so OpenSSL 3 (Vercel/Node 18+) accepts it. Handles \\n, \\\\n, and CRLF. */
function normalizePrivateKey(key: string): string {
  return key
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function getGoogleCreds() {
  if (cachedCreds !== null) return cachedCreds;
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!raw) {
    cachedCreds = null;
    return cachedCreds;
  }
  try {
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
      projectId?: string;
    };
    const client_email = parsed.client_email?.trim();
    const private_key = parsed.private_key ? normalizePrivateKey(parsed.private_key) : undefined;
    if (!client_email || !private_key) {
      cachedCreds = null;
      return cachedCreds;
    }
    cachedCreds = {
      credentials: { client_email, private_key },
      projectId: parsed.project_id ?? parsed.projectId,
    };
    return cachedCreds;
  } catch {
    cachedCreds = null;
    return cachedCreds;
  }
}

function getClient() {
  if (cachedClient) return cachedClient;
  const creds = getGoogleCreds();
  cachedClient = creds
    ? new ImageAnnotatorClient({ credentials: creds.credentials, projectId: creds.projectId })
    : new ImageAnnotatorClient();
  return cachedClient;
}

function getStorage() {
  if (cachedStorage) return cachedStorage;
  const creds = getGoogleCreds();
  cachedStorage = creds ? new Storage({ credentials: creds.credentials, projectId: creds.projectId }) : new Storage();
  return cachedStorage;
}

/**
 * Vision via REST + API key. No JWT/private key, so avoids OpenSSL DECODER error on Vercel.
 * Set GOOGLE_VISION_API_KEY in env and enable Vision API for the key's project.
 */
async function extractTextFromImageViaRest(buffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) throw new Error("GOOGLE_VISION_API_KEY is not set");

  const res = await fetch(`${VISION_REST_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: buffer.toString("base64") },
          features: [{ type: "TEXT_DETECTION", maxResults: 10 }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Vision REST failed ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }>;
  };
  const first = data.responses?.[0];
  if (first?.error) throw new Error(first.error.message ?? "Vision API error");
  return first?.fullTextAnnotation?.text ?? "";
}

export async function extractTextFromImage(buffer: Buffer) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (apiKey) return extractTextFromImageViaRest(buffer);
  // On Vercel/serverless the Vision SDK (gRPC) often throws "Cannot call write after a stream was destroyed".
  // Require REST (API key) so OCR works reliably.
  if (process.env.VERCEL) {
    throw new Error(
      "GOOGLE_VISION_API_KEY is required for image OCR on Vercel. Set it in Vercel → Project → Settings → Environment Variables and enable Cloud Vision API for the key.",
    );
  }
  const client = getClient();
  const [result] = await client.textDetection({ image: { content: buffer } });
  const text = result.fullTextAnnotation?.text ?? "";
  return text;
}

function parseGsUri(uri: string) {
  const m = uri.trim().match(/^gs:\/\/([^/]+)(?:\/(.*))?$/);
  if (!m) throw new Error(`Invalid gs:// URI: ${uri}`);
  const bucket = m[1];
  const prefix = (m[2] ?? "").replace(/\/+$/, "");
  return { bucket, prefix };
}

function getPdfMaxPages() {
  const raw = process.env.GOOGLE_VISION_PDF_MAX_PAGES;
  // On Vercel (especially Hobby), keep it very small to reduce runtime/timeout risk.
  const n = raw ? Number(raw) : process.env.VERCEL ? 1 : 5;
  return Number.isFinite(n) && n > 0 && n <= 20 ? Math.floor(n) : 5;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function visionStartPdfOcrViaRest(opts: {
  apiKey: string;
  sourceUri: string;
  destinationUri: string;
  pages: number[];
}) {
  const res = await fetch(`${VISION_FILES_ASYNC_REST_URL}?key=${encodeURIComponent(opts.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: { gcsSource: { uri: opts.sourceUri }, mimeType: "application/pdf" },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: opts.pages,
          outputConfig: { gcsDestination: { uri: opts.destinationUri } },
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vision PDF REST start failed ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Vision PDF REST start failed: missing operation name");
  return data.name;
}

async function visionWaitOperationViaRest(opts: { apiKey: string; operationName: string; timeoutMs: number }) {
  const started = Date.now();
  let delay = 500;
  while (Date.now() - started < opts.timeoutMs) {
    const url = `${VISION_OPERATIONS_REST_BASE}${encodeURIComponent(opts.operationName)}?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vision op poll failed ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as { done?: boolean; error?: { message?: string } };
    if (data.error?.message) throw new Error(`Vision op failed: ${data.error.message}`);
    if (data.done) return;
    await sleep(delay);
    delay = Math.min(2000, Math.floor(delay * 1.5));
  }
  throw new Error("Vision PDF OCR operation still running (timeout). Try again soon.");
}

export async function extractTextFromPdfScannedViaVision(buffer: Buffer, opts?: { docId?: string }) {
  const outUri = process.env.GOOGLE_VISION_OCR_GCS_OUTPUT_URI;
  if (!outUri) return "";

  const { bucket, prefix } = parseGsUri(outUri);
  const storage = getStorage();

  const docId = opts?.docId ?? "doc";
  const stamp = Date.now();
  const outPrefix = [prefix, "vision", docId, String(stamp)].filter(Boolean).join("/");
  const destination = `gs://${bucket}/${outPrefix}/`;
  const sourceObjectName = `${outPrefix}/input.pdf`;
  const sourceUri = `gs://${bucket}/${sourceObjectName}`;

  // Vision async PDF OCR requires a GCS source. Upload the PDF temporarily.
  await storage.bucket(bucket).file(sourceObjectName).save(buffer, {
    resumable: false,
    contentType: "application/pdf",
    validation: false,
  });

  const maxPages = getPdfMaxPages();
  const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

  // On Vercel/serverless, the Vision SDK (gRPC) is prone to "Cannot call write after a stream was destroyed".
  // Prefer the Vision REST API when an API key is available.
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey && process.env.VERCEL) {
    throw new Error(
      "GOOGLE_VISION_API_KEY is required for PDF OCR on Vercel (to avoid Vision SDK stream errors). Set it in Vercel → Project → Settings → Environment Variables.",
    );
  }
  if (apiKey) {
    const opName = await visionStartPdfOcrViaRest({ apiKey, sourceUri, destinationUri: destination, pages });
    const timeoutMs = process.env.VERCEL ? 8000 : 30_000;
    try {
      await visionWaitOperationViaRest({ apiKey, operationName: opName, timeoutMs });
    } catch (e) {
      // If polling timed out, the operation may still finish shortly.
      // We'll try listing outputs anyway before failing later.
      console.warn("[vision/pdf] operation not done yet; trying output listing", {
        docId,
        opName,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    const client = getClient();
    // Types in @google-cloud/vision lag behind some request fields in practice (e.g. `pages`).
    type AsyncBatchClient = { asyncBatchAnnotateFiles: (req: unknown) => Promise<unknown[]> };
    const opTuple = await (client as unknown as AsyncBatchClient).asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: { gcsSource: { uri: sourceUri }, mimeType: "application/pdf" },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages,
          outputConfig: { gcsDestination: { uri: destination } },
        },
      ],
    } as unknown);
    const operation = opTuple[0] as { promise: () => Promise<unknown> };

    // Wait for operation completion (Vision runs async for PDFs)
    await operation.promise();
  }

  // The output is one or more JSON files under outPrefix.
  // We list and read them back, concatenate text across pages.
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outPrefix });
  const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
  if (jsonFiles.length === 0) return "";

  let text = "";
  for (const f of jsonFiles) {
    const [content] = await f.download();
    try {
      const parsed = JSON.parse(content.toString("utf8")) as {
        responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
      };
      for (const r of parsed.responses ?? []) {
        const t = r.fullTextAnnotation?.text;
        if (t && t.trim()) text += (text ? "\n\n" : "") + t.trim();
      }
    } catch {
      // ignore malformed file
    }
  }

  // Best-effort cleanup (avoid leaving output files around)
  // Vision sometimes writes .json plus metadata; delete everything under prefix.
  try {
    await Promise.allSettled(files.map((f) => f.delete()));
  } catch {
    // ignore
  }

  // Small delay to reduce potential consistency issues for some buckets
  if (!text.trim()) await sleep(150);
  return text;
}


