/**
 * Gera os ícones de instalação na tela inicial (PWA) a partir do emblema da marca.
 *
 * Fonte única: `src/assets/logo-icon.png`, o mesmo arquivo usado por `LivreOSLogo`.
 * O arquivo costuma vir com moldura vazia e fundo branco (igual ao tratado em
 * `src/components/brand/LivreOSLogo.tsx`): aqui o desenho é recortado no limite do
 * emblema e o fundo branco vira transparência, para o ícone preencher o quadro.
 *
 * Roda automaticamente no início do servidor de desenvolvimento e do build
 * (ver `vite.config.ts`), então trocar o emblema já refaz todo o conjunto.
 *
 * A raiz do projeto vem por parâmetro. Aqui não dá para usar `import.meta.url`:
 * dentro do `vite.config.ts` este arquivo é empacotado junto com a configuração,
 * e `import.meta.url` passa a apontar para o bundle da config (um nível acima de
 * `scripts/`) — a leitura do emblema falhava e os ícones nunca eram atualizados.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

/** Mesma tolerância do `LivreOSLogo`: pixel claro demais conta como fundo. */
const LIMITE_CLARO = 236;
/** Verde da marca (`theme_color` dos manifestos). */
const FUNDO_MARCA: Cor = [10, 61, 44, 255];

type Cor = [number, number, number, number];

interface Bitmap {
  largura: number;
  altura: number;
  /** RGBA, 8 bits por canal. */
  pixels: Uint8Array;
}

interface IconeGerado {
  caminho: string;
  descricao: string;
}

function ehFundo(pixels: Uint8Array, i: number): boolean {
  return (
    pixels[i + 3] < 12 ||
    (pixels[i] > LIMITE_CLARO && pixels[i + 1] > LIMITE_CLARO && pixels[i + 2] > LIMITE_CLARO)
  );
}

function ehBranco(pixels: Uint8Array, i: number): boolean {
  return pixels[i] > LIMITE_CLARO && pixels[i + 1] > LIMITE_CLARO && pixels[i + 2] > LIMITE_CLARO;
}

async function lerPng(caminho: string): Promise<Bitmap> {
  const png = PNG.sync.read(await readFile(caminho));
  return { largura: png.width, altura: png.height, pixels: new Uint8Array(png.data) };
}

async function salvarPng(bitmap: Bitmap, caminho: string): Promise<void> {
  const png = new PNG({ width: bitmap.largura, height: bitmap.altura });
  png.data = Buffer.from(bitmap.pixels);
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, PNG.sync.write(png));
}

/** Recorta a moldura vazia e transforma o fundo branco em transparência. */
function recortarEmblema(origem: Bitmap): Bitmap {
  const { largura, altura, pixels } = origem;
  let topo = altura;
  let esquerda = largura;
  let direita = -1;
  let base = -1;

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (ehFundo(pixels, (y * largura + x) * 4)) continue;
      if (x < esquerda) esquerda = x;
      if (x > direita) direita = x;
      if (y < topo) topo = y;
      if (y > base) base = y;
    }
  }
  if (direita < esquerda || base < topo) return origem;

  const larguraRecorte = direita - esquerda + 1;
  const alturaRecorte = base - topo + 1;
  const destino: Bitmap = {
    largura: larguraRecorte,
    altura: alturaRecorte,
    pixels: new Uint8Array(larguraRecorte * alturaRecorte * 4),
  };

  for (let y = 0; y < alturaRecorte; y++) {
    for (let x = 0; x < larguraRecorte; x++) {
      const origemIndice = ((y + topo) * largura + (x + esquerda)) * 4;
      const destinoIndice = (y * larguraRecorte + x) * 4;
      destino.pixels[destinoIndice] = pixels[origemIndice];
      destino.pixels[destinoIndice + 1] = pixels[origemIndice + 1];
      destino.pixels[destinoIndice + 2] = pixels[origemIndice + 2];
      destino.pixels[destinoIndice + 3] = ehBranco(pixels, origemIndice)
        ? 0
        : pixels[origemIndice + 3];
    }
  }

  return destino;
}

function criarTela(lado: number, fundo: Cor | null): Bitmap {
  const bitmap: Bitmap = { largura: lado, altura: lado, pixels: new Uint8Array(lado * lado * 4) };
  if (!fundo) return bitmap;

  for (let i = 0; i < bitmap.pixels.length; i += 4) {
    bitmap.pixels[i] = fundo[0];
    bitmap.pixels[i + 1] = fundo[1];
    bitmap.pixels[i + 2] = fundo[2];
    bitmap.pixels[i + 3] = fundo[3];
  }
  return bitmap;
}

function compor(tela: Bitmap, x: number, y: number, r: number, g: number, b: number, alfa: number) {
  const i = (y * tela.largura + x) * 4;
  const alfaDestino = tela.pixels[i + 3] / 255;
  const alfaFinal = alfa + alfaDestino * (1 - alfa);
  if (alfaFinal <= 0) {
    tela.pixels[i + 3] = 0;
    return;
  }
  tela.pixels[i] = Math.round((r * alfa + tela.pixels[i] * alfaDestino * (1 - alfa)) / alfaFinal);
  tela.pixels[i + 1] = Math.round(
    (g * alfa + tela.pixels[i + 1] * alfaDestino * (1 - alfa)) / alfaFinal,
  );
  tela.pixels[i + 2] = Math.round(
    (b * alfa + tela.pixels[i + 2] * alfaDestino * (1 - alfa)) / alfaFinal,
  );
  tela.pixels[i + 3] = Math.round(alfaFinal * 255);
}

/**
 * Reduz o emblema (média de área, sem franja escura nas bordas) e desenha
 * centralizado na tela, ocupando no máximo `ocupacao` do lado.
 */
function desenharEmblema(origem: Bitmap, tela: Bitmap, ocupacao: number): void {
  const limite = tela.largura * ocupacao;
  const escala = Math.min(limite / origem.largura, limite / origem.altura);
  const largura = Math.max(1, Math.round(origem.largura * escala));
  const altura = Math.max(1, Math.round(origem.altura * escala));
  const x0 = Math.floor((tela.largura - largura) / 2);
  const y0 = Math.floor((tela.altura - altura) / 2);

  const passoX = origem.largura / largura;
  const passoY = origem.altura / altura;

  for (let y = 0; y < altura; y++) {
    const inicioY = Math.floor(y * passoY);
    const fimY = Math.max(inicioY + 1, Math.min(origem.altura, Math.floor((y + 1) * passoY)));
    for (let x = 0; x < largura; x++) {
      const inicioX = Math.floor(x * passoX);
      const fimX = Math.max(inicioX + 1, Math.min(origem.largura, Math.floor((x + 1) * passoX)));

      let r = 0;
      let g = 0;
      let b = 0;
      let somaAlfa = 0;
      let amostras = 0;

      for (let origemY = inicioY; origemY < fimY; origemY++) {
        for (let origemX = inicioX; origemX < fimX; origemX++) {
          const i = (origemY * origem.largura + origemX) * 4;
          const alfa = origem.pixels[i + 3];
          // Peso pelo alfa: pixels transparentes não puxam a cor para o preto.
          r += origem.pixels[i] * alfa;
          g += origem.pixels[i + 1] * alfa;
          b += origem.pixels[i + 2] * alfa;
          somaAlfa += alfa;
          amostras++;
        }
      }

      const alfa = amostras > 0 ? somaAlfa / (amostras * 255) : 0;
      if (alfa <= 0) continue;
      compor(tela, x0 + x, y0 + y, r / somaAlfa, g / somaAlfa, b / somaAlfa, alfa);
    }
  }
}

function paraSvg(bitmap: Bitmap): string {
  const png = new PNG({ width: bitmap.largura, height: bitmap.altura });
  png.data = Buffer.from(bitmap.pixels);
  const base64 = PNG.sync.write(png).toString("base64");
  const lado = bitmap.largura;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" ` +
    `viewBox="0 0 ${lado} ${lado}" role="img" aria-label="LivreOS">` +
    `<image width="${lado}" height="${lado}" href="data:image/png;base64,${base64}"/>` +
    `</svg>\n`
  );
}

let emAndamento: Promise<IconeGerado[]> | null = null;

async function gerar(raiz: string): Promise<IconeGerado[]> {
  const emblema = recortarEmblema(await lerPng(resolve(raiz, "src/assets/logo-icon.png")));
  const gerados: IconeGerado[] = [];

  const escrever = async (caminho: string, bitmap: Bitmap, descricao: string) => {
    await salvarPng(bitmap, caminho);
    gerados.push({ caminho, descricao });
  };

  for (const lado of [192, 512]) {
    // Ícone comum: verde da marca ao fundo, emblema grande e centrado.
    const icone = criarTela(lado, FUNDO_MARCA);
    desenharEmblema(emblema, icone, 0.78);
    await escrever(resolve(raiz, `public/icons/icon-${lado}.png`), icone, `icon-${lado}`);

    // Maskable: o sistema recorta até 20% de cada borda, então o emblema recua.
    const maskable = criarTela(lado, FUNDO_MARCA);
    desenharEmblema(emblema, maskable, 0.58);
    await escrever(
      resolve(raiz, `public/icons/icon-${lado}-maskable.png`),
      maskable,
      `icon-${lado}-maskable`,
    );
  }

  const apple = criarTela(180, FUNDO_MARCA);
  desenharEmblema(emblema, apple, 0.72);
  await escrever(resolve(raiz, "public/icons/apple-touch-icon.png"), apple, "apple-touch-icon");

  const favicon = criarTela(32, FUNDO_MARCA);
  desenharEmblema(emblema, favicon, 0.88);
  await escrever(resolve(raiz, "public/favicon.png"), favicon, "favicon");

  // Favicon vetorial: emblema sem fundo, como a marca aparece dentro do ERP.
  const marca = criarTela(512, null);
  desenharEmblema(emblema, marca, 0.98);
  const svg = resolve(raiz, "public/icons/livreos.svg");
  await mkdir(dirname(svg), { recursive: true });
  await writeFile(svg, paraSvg(marca));
  gerados.push({ caminho: svg, descricao: "livreos.svg" });

  return gerados;
}

/**
 * Gera o conjunto completo (uma vez por processo) e devolve os arquivos escritos.
 * `raiz` é o diretório do projeto — informe-o sempre (por padrão, o diretório atual).
 */
export function generatePwaIcons(raiz: string = process.cwd()): Promise<IconeGerado[]> {
  emAndamento ??= gerar(raiz).catch((erro) => {
    emAndamento = null;
    throw erro;
  });
  return emAndamento;
}
