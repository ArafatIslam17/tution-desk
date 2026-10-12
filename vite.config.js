import { defineConfig } from 'vite';

// On Vercel, refuse to build without the Supabase settings: a deployed site must never
// run without its database (locally, `npm run dev` falls back to a browser-only preview mode).
if (process.env.VERCEL && !process.env.VITE_SUPABASE_URL?.trim() || process.env.VERCEL && !process.env.VITE_SUPABASE_ANON_KEY?.trim()) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them in Vercel → Project → Settings → Environment Variables, then redeploy.');
}

export default defineConfig({
  base: '/',
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
