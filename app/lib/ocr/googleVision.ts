import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";

let cachedClient: ImageAnnotatorClient | null = null;
let cachedStorage: Storage | null = null;
let cachedCreds:
  | null
  | {
      credentials: { client_email: string; private_key: string };
      projectId?: string;
    } = null;

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
    const client_email = parsed.client_email;
    const private_key = parsed.private_key?.replace(/\\n/g, "\n");
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

export async function extractTextFromImage(buffer: Buffer) {
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
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) && n > 0 && n <= 20 ? Math.floor(n) : 5;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function extractTextFromPdfScannedViaVision(buffer: Buffer, opts?: { docId?: string }) {
  const outUri = process.env.GOOGLE_VISION_OCR_GCS_OUTPUT_URI;
  if (!outUri) return "";

  const { bucket, prefix } = parseGsUri(outUri);
  const storage = getStorage();
  const client = getClient();

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


