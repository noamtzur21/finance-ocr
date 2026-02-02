This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment

Copy `config/env.example` to `.env` and fill in the values.

### Database

1. Set `DATABASE_URL` in `.env`
2. Generate client: `npm run db:generate`
3. Run migrations: `npm run db:migrate`

### Deploy (GitHub + Vercel – project: finance-ocr)

**חיבור חד-פעמי:** הרץ פעם אחת מתוך תיקיית הפרויקט:
```bash
npm run link
```
בחר את ה-Account ואז **Link to existing project** → **finance-ocr**.

**לאחר כל שינוי – דחיפה ל-GitHub ודיפלוי ל-Vercel:**
```bash
npm run ship -- "תיאור השינוי"
```
(מחליף את "תיאור השינוי" בהודעת הקומיט. אם אין שינויים, רק ידפלס ל-Vercel.)

### First user (one-user system)

1. Start dev server: `npm run dev`
2. Go to `/setup` and create your single user.

### Password vault

To use the passwords page (`/credentials`), set `CREDENTIALS_ENCRYPTION_KEY` in your `.env`:

`openssl rand -base64 32`

### OCR (Google Vision)

- **Recommended on Vercel:** Set `GOOGLE_VISION_API_KEY` (API key from Google Cloud Console → APIs & Services → Credentials). Vision is then called via REST and avoids the OpenSSL DECODER error. Enable "Cloud Vision API" for the key’s project.
- **Alternative:** Set `GOOGLE_CREDENTIALS_JSON` to the full service-account JSON. On Vercel, if you see `error:1E08010C:DECODER routines::unsupported`, prefer using `GOOGLE_VISION_API_KEY` instead.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
