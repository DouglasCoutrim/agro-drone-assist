import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';
import { generatePwaIcons } from "./scripts/generate-pwa-icons";

/**
 * Refaz os ícones de instalação do PWA a partir de `src/assets/logo-icon.png`
 * (emblema da marca) sempre que o servidor de desenvolvimento ou o build começa.
 */
function iconesPwa() {
  const gerar = async (contexto: string) => {
    try {
      const arquivos = await generatePwaIcons();
      if (arquivos.length > 0) {
        console.log(
          `[pwa-icons] ${arquivos.length} ícones gerados de src/assets/logo-icon.png (${contexto}).`,
        );
      }
    } catch (erro) {
      // Nunca derruba o app por causa de ícone: mantém os arquivos já existentes.
      console.warn(`[pwa-icons] falha ao gerar os ícones (${contexto}):`, erro);
    }
  };

  return {
    name: "livreos-pwa-icons",
    configureServer: () => gerar("dev"),
    buildStart: () => gerar("build"),
  };
}

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
    iconesPwa(),
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
