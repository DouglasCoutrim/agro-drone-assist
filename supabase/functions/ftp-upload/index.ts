import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FTPConfig {
  host: string
  port: number
  username: string
  password: string
  basePath: string
  publicBase: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Lê uma resposta FTP completa (linha final no formato "NNN ..."). */
async function readReply(conn: Deno.Conn): Promise<string> {
  let buffer = ""
  const buf = new Uint8Array(8192)
  while (true) {
    const n = await conn.read(buf)
    if (n === null) break
    buffer += decoder.decode(buf.subarray(0, n))
    // Só consideramos a resposta completa quando ela termina em CRLF e a
    // última linha não-vazia é uma linha final "código + espaço".
    if (buffer.endsWith("\r\n")) {
      const lines = buffer.split("\r\n").filter((l) => l.length > 0)
      const last = lines[lines.length - 1] || ""
      if (/^\d{3} /.test(last)) break
    }
  }
  return buffer
}

async function openFtp(config: FTPConfig): Promise<{ conn: Deno.Conn; send: (cmd: string) => Promise<string> }> {
  const conn = await Deno.connect({ hostname: config.host, port: config.port })

  const send = async (cmd: string): Promise<string> => {
    await conn.write(encoder.encode(cmd + "\r\n"))
    return await readReply(conn)
  }

  // Mensagem de boas-vindas
  const welcome = await readReply(conn)
  console.log("[ftp-upload] conectado", { reply: welcome.split("\r\n")[0] })

  const user = await send(`USER ${config.username}`)
  if (!user.startsWith("331")) {
    throw new Error(`FTP USER falhou: ${user.trim()}`)
  }

  const pass = await send(`PASS ${config.password}`)
  if (!pass.startsWith("230")) {
    throw new Error(`FTP login recusado: ${pass.trim()}`)
  }

  // Modo binário obrigatório para imagens
  await send("TYPE I")

  return { conn, send }
}

function buildPublicUrl(config: FTPConfig, relativePath: string): string {
  const base = config.publicBase.replace(/\/+$/, "")
  const rel = relativePath.replace(/^\/+/, "")
  return `${base}/${rel}`
}

async function uploadToFTP(config: FTPConfig, relativePath: string, fileData: Uint8Array): Promise<string> {
  const { conn, send } = await openFtp(config)
  const remotePath = `${config.basePath}/${relativePath}`.replace(/\/+/g, "/")

  try {
    // Modo passivo
    const pasvResp = await send("PASV")
    const m = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/)
    if (!m) throw new Error("Falha ao entrar em modo passivo: " + pasvResp.trim())

    const dataHost = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`
    const dataPort = parseInt(m[5], 10) * 256 + parseInt(m[6], 10)

    // Cria as pastas necessárias (ignora erro se já existirem)
    const parts = remotePath.split("/").filter(Boolean)
    let acc = ""
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i]
      const mk = await send(`MKD ${acc}`)
      // 257 = criado; 550 = já existe / sem permissão — segue em frente
      if (!mk.startsWith("257") && !mk.startsWith("550")) {
        console.log("[ftp-upload] MKD inesperado", { path: acc, reply: mk.trim() })
      }
    }

    // Abre canal de dados passivo
    const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort })

    const stor = await send(`STOR ${remotePath}`)
    if (!stor.startsWith("150") && !stor.startsWith("125")) {
      dataConn.close()
      throw new Error(`FTP STOR falhou: ${stor.trim()}`)
    }

    await dataConn.write(fileData)
    try {
      await dataConn.close()
    } catch (_e) {
      // ignore
    }

    const done = await send("")
    if (!done.startsWith("226") && !done.startsWith("250")) {
      throw new Error(`FTP transferência falhou: ${done.trim()}`)
    }

    await send("QUIT").catch(() => {})
    try {
      conn.close()
    } catch (_e) {
      // ignore
    }

    return buildPublicUrl(config, relativePath)
  } catch (error) {
    try {
      conn.close()
    } catch (_e) {
      // ignore
    }
    throw error
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log("[ftp-upload] usuário inválido", { error: userError?.message })
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return new Response("Organization not found", { status: 400, headers: corsHeaders })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const ordemServicoId = formData.get("ordem_servico_id") as string
    const descricao = (formData.get("descricao") as string) || ""

    if (!file || !ordemServicoId) {
      return new Response("Missing file or ordem_servico_id", { status: 400, headers: corsHeaders })
    }
    if (!file.type.startsWith("image/")) {
      return new Response("Only images allowed", { status: 400, headers: corsHeaders })
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response("File too large (max 5MB)", { status: 400, headers: corsHeaders })
    }

    const config: FTPConfig = {
      host: Deno.env.get("FTP_HOST") || "",
      port: parseInt(Deno.env.get("FTP_PORT") || "21", 10),
      username: Deno.env.get("FTP_USERNAME") || "",
      password: Deno.env.get("FTP_PASSWORD") || "",
      basePath: Deno.env.get("FTP_BASE_PATH") || "/uploads",
      publicBase: Deno.env.get("FTP_PUBLIC_URL") || "",
    }

    if (!config.host || !config.username || !config.password) {
      console.error("[ftp-upload] faltam variáveis FTP", { host: config.host, username: config.username })
      return new Response(
        JSON.stringify({ error: "FTP não configurado (FTP_HOST/FTP_USERNAME/FTP_PASSWORD)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Caminho relativo: {organization_id}/{ordem_servico_id}/{arquivo}
    // Cada empresa tem sua própria pasta; cada OS tem uma subpasta.
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const fileName = `${timestamp}_${safeName}`
    const relativePath = `${profile.organization_id}/${ordemServicoId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    console.log("[ftp-upload] enviando", { relativePath, bytes: fileData.length })
    const publicUrl = await uploadToFTP(config, relativePath, fileData)

    const { error: insertError } = await supabase.from("os_anexos").insert({
      ordem_servico_id: ordemServicoId,
      organization_id: profile.organization_id,
      nome_arquivo: fileName,
      url: publicUrl,
      tipo: file.type,
      tamanho: file.size,
      usuario_id: user.id,
      descricao: descricao,
    })

    if (insertError) {
      console.error("[ftp-upload] falha ao salvar registro", { error: insertError.message })
      return new Response(
        JSON.stringify({ error: "Upload concluído, mas o registro não foi salvo: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    return new Response(JSON.stringify({ url: publicUrl, fileName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("[ftp-upload] erro", { message: error?.message, stack: error?.stack })
    return new Response(JSON.stringify({ error: error?.message || "Falha no upload FTP" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})