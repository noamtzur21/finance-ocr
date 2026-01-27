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

    GOOGLE_APPLICATION_CREDENTIALS: isSet("GOOGLE_APPLICATION_CREDENTIALS"),
    GOOGLE_VISION_OCR_GCS_OUTPUT_URI: isSet("GOOGLE_VISION_OCR_GCS_OUTPUT_URI"),
  };

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks });
}


