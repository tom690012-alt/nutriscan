# NutriScan AI (full app)
1. `npm install`
2. `cp .env.example .env.local` and fill in `OPENAI_API_KEY` and `FDC_API_KEY` (free: https://fdc.nal.usda.gov/api-key-signup)
3. `npm run dev` then open http://localhost:3000
Deploy: push to GitHub, import in Vercel, add the same env vars. Keys stay server-side.
Not included yet: Supabase accounts/history, AI assistant chat, vitamins/minerals.
