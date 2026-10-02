import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Both values are public browser credentials. Use the managed environment when
// available; the fallback prevents a publication missing .env from going blank.
const PUBLIC_CLOUD_URL = "https://iynljexyjhbkfxsurddn.supabase.co";
const PUBLIC_CLOUD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bmxqZXh5amhia2Z4c3VyZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjY4MDUsImV4cCI6MjA4MDcwMjgwNX0.CRE9hg8SldQb7Ec3eohNPAu4nwXNnKLjZtrKla4EGWA";

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
  plugins: [
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
