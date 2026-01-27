import { NextResponse } from "next/server";

function isSet(name: string) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export async function GET() {
  const checks = {
    DATABASE_URL: isSet("DATABASE_URL"),
    AUTH_SECRET: isSet("AUTH_SECRET"),
    CREDENTIALS_ENCRYPTION_KEY: isSet("CREDENTIALS_ENCRYPTION_KEY"),

    R2_ACCOUNT_ID: isSet("R2_ACCOUNT_ID"),
    R2_ACCESS_KEY_ID: isSet("R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: isSet("R2_SECRET_ACCESS_KEY"),
    R2_BUCKET: isSet("R2_BUCKET"),

    // Production uses GOOGLE_CREDENTIALS_JSON; local dev may use GOOGLE_APPLICATION_CREDENTIALS path.
    GOOGLE_CREDENTIALS_JSON: isSet("GOOGLE_CREDENTIALS_JSON"),
    GOOGLE_APPLICATION_CREDENTIALS: isSet("GOOGLE_APPLICATION_CREDENTIALS"),
    GOOGLE_VISION_OCR_GCS_OUTPUT_URI: isSet("GOOGLE_VISION_OCR_GCS_OUTPUT_URI"),
    GOOGLE_VISION_PDF_MAX_PAGES: isSet("GOOGLE_VISION_PDF_MAX_PAGES"),
    CRON_SECRET: isSet("CRON_SECRET"),
  };

  const googleOk = checks.GOOGLE_CREDENTIALS_JSON || checks.GOOGLE_APPLICATION_CREDENTIALS;
  const ok =
    checks.DATABASE_URL &&
    checks.AUTH_SECRET &&
    checks.CREDENTIALS_ENCRYPTION_KEY &&
    checks.R2_ACCOUNT_ID &&
    checks.R2_ACCESS_KEY_ID &&
    checks.R2_SECRET_ACCESS_KEY &&
    checks.R2_BUCKET &&
    checks.GOOGLE_VISION_OCR_GCS_OUTPUT_URI &&
    checks.GOOGLE_VISION_PDF_MAX_PAGES &&
    checks.CRON_SECRET &&
    googleOk;
  return NextResponse.json({ ok, checks });
}


