export function slugifyVendor(vendor: string) {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function randomSuffix(len = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function buildR2Key(opts: {
  userId: string;
  date: Date;
  amount?: string;
  vendor?: string;
  ext: string;
}) {
  const yyyy = opts.date.getFullYear();
  const mm = String(opts.date.getMonth() + 1).padStart(2, "0");
  const dd = String(opts.date.getDate()).padStart(2, "0");
  const vendorSlug = opts.vendor ? slugifyVendor(opts.vendor) : "unknown";
  const amountSlug = opts.amount ? opts.amount.replace(/[^\d.]/g, "") : "0";
  return `receipts/${opts.userId}/${yyyy}/${mm}/${yyyy}-${mm}-${dd}_${amountSlug}_${vendorSlug}_${randomSuffix()}.${opts.ext}`;
}


