import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

// Both values are public browser credentials. Use the managed environment when
// available; the fallback prevents a publication missing .env from going blank.
const PUBLIC_CLOUD_URL = "https://qanmmpjofbacoxlxcgfy.supabase.co";
const PUBLIC_CLOUD_KEY = "sb_publishable_dCqriRZlaAp6SE-LL_KR6w_aXk3aIsM";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const publicUrl = env.VITE_SUPABASE_URL || PUBLIC_CLOUD_URL;
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_CLOUD_KEY;

  return ({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicKey),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), 
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@supabase/supabase-js"],
  },
  });
});
