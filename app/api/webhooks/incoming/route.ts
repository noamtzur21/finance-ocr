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

function normalizeAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return n;
}

function parseQuickTransaction(text: string): { vendor: string; amount: number; currency: "ILS" | "USD" | "EUR" } | null {
  const t = text.trim();
  if (!t) return null;

  // Pattern A: "<vendor> סכום <amount> <currency?>"
  const m1 = t.match(
    /^(?<vendor>.+?)\s+(?:סכום|amount)\s*[:\-]?\s*(?<amount>\d+(?:[.,]\d{1,2})?)\s*(?<cur>₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur)?\s*$/i,
  );
  // Pattern B: "<vendor> <amount> <currency?>"
  const m2 = t.match(
    /^(?<vendor>.+?)\s+(?<amount>\d+(?:[.,]\d{1,2})?)\s*(?<cur>₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur)?\s*$/i,
  );
  const m = m1 ?? m2;
  const vendorRaw = (m?.groups?.vendor ?? "").trim();
  const amountRaw = (m?.groups?.amount ?? "").trim().replace(",", ".");
  const curRaw = (m?.groups?.cur ?? "").trim().toLowerCase();
  if (!vendorRaw || !amountRaw) return null;

  const amount = normalizeAmount(amountRaw);
  if (amount === null) return null;

  let currency: "ILS" | "USD" | "EUR" = "ILS";
  if (curRaw.includes("$") || curRaw.includes("usd") || curRaw.includes("דולר")) currency = "USD";
  if (curRaw.includes("€") || curRaw.includes("eur")) currency = "EUR";
  if (curRaw.includes("₪") || curRaw.includes("שח") || curRaw.includes("ש\"ח") || curRaw.includes("שקל") || curRaw.includes("nis") || curRaw.includes("ils"))
    currency = "ILS";

  // If no explicit currency but message is mostly English, assume USD.
  if (!curRaw) {
    const hasHebrew = /[\u0590-\u05FF]/.test(t);
    const hasLatin = /[a-z]/i.test(t);
    if (!hasHebrew && hasLatin) currency = "USD";
  }

  const vendor = vendorRaw.slice(0, 120);
  return { vendor, amount, currency };
}

export async function POST(req: Request) {
  const body = await parseIncomingBody(req);
  const from = body.From ?? body.from ?? "";
  const messageBody = (body.Body ?? body.body ?? "").trim();
  const numMedia = parseInt(body.NumMedia ?? body.NumMedia ?? "0", 10);
  const mediaUrl = body.MediaUrl0 ?? body.MediaUrl0 ?? "";
  const mediaContentType = body.MediaContentType0 ?? body.MediaContentType0 ?? "image/jpeg";

  // Debug: log so you can see in Vercel/host logs if webhook received and what Twilio sent
  console.log("[webhooks/incoming] From=%s NumMedia=%s MediaUrl0=%s", from, numMedia, mediaUrl ? "yes" : "no");

  // 1) קודם לפי השולח (From): כשמשתמש שולח קבלה מהמספר שלו, היא נכנסת לחשבון שלו.
  const fromNormalized = normalizePhone(from);
  let user: { id: string } | null = null;

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

  // 2) אם לא מצאנו לפי השולח – לפי המספר שמקבל (To): כשהלקוח שולח למספר העסקי, נכנס למי שהגדיר את המספר הזה ב"מספר לקבלת קבלות".
  if (!user) {
    const toRaw = body.To ?? body.to ?? "";
    const toNormalized = normalizePhone(toRaw);
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
  }

  if (!user) {
    return twimlMessage("לא נמצא חשבון. אם אתה משתמש – הכנס את מספר הטלפון שלך בהגדרות (המספר שממנו אתה שולח). אם אתה לקוח – שלח למספר העסקי שהתקבל ממך.");
  }

  // If user replied with classification (no media), apply to the latest webhook doc and confirm.
  if (numMedia === 0 || !mediaUrl) {
    const t = messageBody.toLowerCase();
    const wantsReceipt = t === "1" || /קבלה|הוצאה|expense|receipt/i.test(messageBody);
    const wantsInvoice = t === "2" || /חשבונית|הכנסה|income|invoice/i.test(messageBody);

    if (wantsReceipt || wantsInvoice) {
      const since = new Date(Date.now() - 20 * 60 * 1000);
      const latest = await prisma.document.findFirst({
        where: { userId: user.id, createdAt: { gte: since }, fileName: { startsWith: "webhook-" } },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, type: true, createdAt: true },
      });

      if (!latest) {
        return twimlMessage("לא מצאתי מסמך אחרון שסיכמת. שלח קודם תמונה/קובץ ואז השב: 1=קבלה, 2=חשבונית.");
      }

      const newType = wantsInvoice ? "income" : "expense";
      await prisma.document.update({
        where: { id: latest.id },
        data: { type: newType },
        select: { id: true },
      });

      return twimlMessage(newType === "income" ? "סבבה—סימנתי כחשבונית (הכנסה)." : "סבבה—סימנתי כקבלה (הוצאה).");
    }

    // Quick transaction (text-only): "משקה חלבון סכום 12 שקלים"
    const tx = parseQuickTransaction(messageBody);
    if (tx) {
      // Ensure we have a default category so it looks tidy in "תנועות".
      const defaultCategoryName = "כללי";
      const category =
        (await prisma.category.findFirst({
          where: { userId: user.id, name: defaultCategoryName },
          select: { id: true },
        })) ??
        (await prisma.category.create({
          data: { userId: user.id, name: defaultCategoryName },
          select: { id: true },
        }));

      const created = await prisma.transaction.create({
        data: {
          userId: user.id,
          date: new Date(),
          amount: tx.amount.toFixed(2),
          currency: tx.currency,
          vendor: tx.vendor,
          description: null,
          categoryId: category.id,
          cardLast4: null,
        },
        select: { id: true },
      });

      return twimlMessage(
        `אין בעיה 🙂 הוספתי לתנועות: ${tx.vendor} — ${tx.amount.toFixed(2)} ${tx.currency === "ILS" ? "₪" : tx.currency === "USD" ? "$" : "€"} (היום).\nמזהה: ${created.id.slice(0, 8)}`,
      );
    }

    return twimlMessage(
      "אפשר:\n1) לשלוח תמונה/קובץ של קבלה או חשבונית (ואז לענות 1/2)\n2) להוסיף תנועה מהירה בטקסט:\nלדוגמה: משקה חלבון סכום 12 שקלים\nאו: משקה חלבון 12 ₪",
    );
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

    const ext = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
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
    return twimlMessage(
      "קיבלתי את המסמך והוא ייסרק ב‑OCR.\nמה זה?\n1 = קבלה (הוצאה)\n2 = חשבונית (הכנסה)\n\n(אפשר גם לשנות אחר כך בתוך האפליקציה)",
    );
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[webhooks/incoming]", err);
    return twimlMessage("אירעה שגיאה בעיבוד התמונה. נסה שוב או העלה מהאפליקציה.");
  }
}
