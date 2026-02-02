import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";
import { enqueueOcrJob } from "@/app/lib/ocr/worker";

export const runtime = "nodejs";

/** Twilio sends incoming messages with POST. GET is for health checks / browser; we respond so logs show 200 not 307. */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ ok: true, message: "Webhook expects POST with Twilio incoming message body." }),
    { headers: { "Content-Type": "application/json" } },
  );
}

/** Normalize phone to E.164 for lookup. Twilio WhatsApp sends e.g. "whatsapp:+972501234567". */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/^whatsapp:/i, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
  if (digits.length >= 9) return "972" + digits.slice(-9);
  return digits;
}

/** Twilio sends application/x-www-form-urlencoded. Next.js formData() supports it. */
async function parseIncomingBody(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    out[k] = typeof v === "string" ? v : (v as File).name ?? "";
  });
  return out;
}

/** Fetch Twilio media URL with Basic auth (Account SID : Auth Token). */
async function fetchTwilioMedia(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Twilio media fetch failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer, contentType };
}

function twimlMessage(text: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${escapeXml(text)}</Body></Message></Response>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  const body = await parseIncomingBody(req);
  const from = body.From ?? body.from ?? "";
  const numMedia = parseInt(body.NumMedia ?? body.NumMedia ?? "0", 10);
  const mediaUrl = body.MediaUrl0 ?? body.MediaUrl0 ?? "";
  const mediaContentType = body.MediaContentType0 ?? body.MediaContentType0 ?? "image/jpeg";

  // Debug: log so you can see in Vercel/host logs if webhook received and what Twilio sent
  console.log("[webhooks/incoming] From=%s NumMedia=%s MediaUrl0=%s", from, numMedia, mediaUrl ? "yes" : "no");

  // Who receives this message (your WhatsApp Business / Twilio number). When a customer sends a receipt here, the doc goes to the user who owns this number.
  const toRaw = body.To ?? body.to ?? "";
  const toNormalized = normalizePhone(toRaw);

  let user: { id: string } | null = null;

  if (toNormalized) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { whatsappIncomingNumber: toNormalized },
          { whatsappIncomingNumber: `+${toNormalized}` },
        ],
      },
      select: { id: true },
    });
  }

  // Fallback: sender's number is in settings (you send from your own phone → doc goes to you).
  if (!user) {
    const fromNormalized = normalizePhone(from);
    if (fromNormalized) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phoneNumber: fromNormalized },
            { phoneNumber: `+${fromNormalized}` },
          ],
        },
        select: { id: true },
      });
    }
  }

  if (!user) {
    return twimlMessage("לא נמצא חשבון למספר הזה. בהגדרות הכנס את מספר ה-WhatsApp העסקי שלך (מספר Twilio) תחת \"מספר לקבלת קבלות\" – אז כשהלקוח שולח קבלה למספר הזה, היא תיכנס אוטומטית לאתר.");
  }

  if (numMedia === 0 || !mediaUrl) {
    return twimlMessage("שלח תמונה של קבלה או חשבונית כדי שאוכל לעבד אותה.");
  }

  try {
    const { buffer, contentType } = await fetchTwilioMedia(mediaUrl);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existing = await prisma.document.findFirst({
      where: { userId: user.id, sha256: hash },
      select: { id: true },
    });
    if (existing) {
      return twimlMessage("הקבלה הזו כבר נשמרה במערכת.");
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `webhook-${Date.now()}.${ext}`;
    const fileKey = `${user.id}/${Date.now()}-${fileName}`;
    await putObject({ key: fileKey, body: new Uint8Array(buffer), contentType });

    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        type: "expense",
        date: new Date(),
        amount: 0,
        vendor: "Unknown",
        categoryId: null,
        description: null,
        fileKey,
        fileName,
        fileMime: contentType,
        fileSize: buffer.length,
        sha256: hash,
      },
    });

    await enqueueOcrJob({ userId: user.id, docId: doc.id });

    console.log("[webhooks/incoming] Doc created docId=%s userId=%s", doc.id, user.id);
    return twimlMessage("הקבלה התקבלה ותעובד בקרוב. תוכל לראות אותה באפליקציה.");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[webhooks/incoming]", err);
    return twimlMessage("אירעה שגיאה בעיבוד התמונה. נסה שוב או העלה מהאפליקציה.");
  }
}
