# NutriScan AI (full app)
1. `npm install`
2. For Netlify, configure `FDC_API_KEY` in the Functions scope for USDA barcode lookup (free: https://fdc.nal.usda.gov/api-key-signup). Food photos and label reading use Netlify AI Gateway automatically.
3. Use `netlify dev` for the linked Netlify environment, or run `npm run dev` with your own server-side credentials in `.env.local`.
Not included yet: Supabase accounts/history, AI assistant chat, vitamins/minerals.
