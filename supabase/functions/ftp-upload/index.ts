import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadConfig {
  // Caminho preferido: endpoint HTTPS/PHP na hospedagem (sempre permitido de funções serverless)
  httpUploadUrl: string
  httpUploadSecret: string
  // Fallback: FTP direto
  host: string
  port: number
  username: string
  password: string
  basePath: string
  publicBase: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Envia a imagem por HTTPS para o script PHP na hospedagem. */
async function uploadViaHttp(
  config: UploadConfig,
  relativePath: string,
  fileData: Uint8Array,
  contentType: string,
  fileName: string,
): Promise<string> {
  const form = new FormData()
  form.append("relative_path", relativePath)
  form.append("file", new Blob([fileData], { type: contentType }), fileName)

  console.log("[ftp-upload] envio HTTP", { url: config.httpUploadUrl, relativePath, bytes: fileData.length })
  const res = await fetch(config.httpUploadUrl, {
    method: "POST",
    headers: { "X-Upload-Secret": config.httpUploadSecret },
    body: form,
  })

  const text = await res.text()
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          "Script upload-os-image.php não encontrado na hospedagem. " +
          "Envie o arquivo para public_html/upload-os-image.php.",
        )
      }
      throw new Error(`Upload HTTPS falhou (${res.status}): ${text.slice(0, 300)}`)
    }

  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Resposta inválida do servidor PHP: ${text.slice(0, 300)}`)
  }
  if (json?.error) throw new Error(json.error)
  if (!json?.url) throw new Error("O servidor PHP não retornou a URL do arquivo.")
  return json.url
}

/** Lê uma resposta FTP completa (linha final no formato "NNN ..."). */
async function readReply(conn: Deno.Conn): Promise<string> {
  let buffer = ""
  const buf = new Uint8Array(8192)
  while (true) {
    const n = await conn.read(buf)
    if (n === null) break
    buffer += decoder.decode(buf.subarray(0, n))
    if (buffer.endsWith("\r\n")) {
      const lines = buffer.split("\r\n").filter((l) => l.length > 0)
      const last = lines[lines.length - 1] || ""
      if (/^\d{3} /.test(last)) break
    }
  }
  return buffer
}

async function uploadViaFtp(config: UploadConfig, relativePath: string, fileData: Uint8Array): Promise<string> {
  const conn = await Deno.connect({ hostname: config.host, port: config.port })
  const send = async (cmd: string): Promise<string> => {
    await conn.write(encoder.encode(cmd + "\r\n"))
    return await readReply(conn)
  }

  const remotePath = `${config.basePath}/${relativePath}`.replace(/\/+/g, "/")

  try {
    await readReply(conn)
    const user = await send(`USER ${config.username}`)
    if (!user.startsWith("331")) throw new Error(`FTP USER falhou: ${user.trim()}`)
    const pass = await send(`PASS ${config.password}`)
    if (!pass.startsWith("230")) throw new Error(`FTP login recusado: ${pass.trim()}`)
    await send("TYPE I")

    const pasvResp = await send("PASV")
    const m = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/)
    if (!m) throw new Error("Falha ao entrar em modo passivo: " + pasvResp.trim())
    const dataHost = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`
    const dataPort = parseInt(m[5], 10) * 256 + parseInt(m[6], 10)

    const parts = remotePath.split("/").filter(Boolean)
    let acc = ""
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i]
      const mk = await send(`MKD ${acc}`)
      if (!mk.startsWith("257") && !mk.startsWith("550")) {
        console.log("[ftp-upload] MKD inesperado", { path: acc, reply: mk.trim() })
      }
    }

    const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort })
    const stor = await send(`STOR ${remotePath}`)
    if (!stor.startsWith("150") && !stor.startsWith("125")) {
      dataConn.close()
      throw new Error(`FTP STOR falhou: ${stor.trim()}`)
    }
    await dataConn.write(fileData)
    try { await dataConn.close() } catch { /* ignore */ }

    const done = await send("")
    if (!done.startsWith("226") && !done.startsWith("250")) {
      throw new Error(`FTP transferência falhou: ${done.trim()}`)
    }
    await send("QUIT").catch(() => {})
    try { conn.close() } catch { /* ignore */ }

    const base = config.publicBase.replace(/\/+$/, "")
    return `${base}/${relativePath.replace(/^\/+/, "")}`
  } catch (error) {
    try { conn.close() } catch { /* ignore */ }
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

    // Configuração lida com a service role (tabela não exposta ao cliente).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const { data: cfg } = await admin
      .from("ftp_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    const config: UploadConfig = {
      httpUploadUrl: cfg?.http_upload_url || Deno.env.get("HTTP_UPLOAD_URL") || "",
      httpUploadSecret: cfg?.http_upload_secret || Deno.env.get("HTTP_UPLOAD_SECRET") || "",
      host: cfg?.host || Deno.env.get("FTP_HOST") || "",
      port: cfg?.port || parseInt(Deno.env.get("FTP_PORT") || "21", 10),
      username: cfg?.username || Deno.env.get("FTP_USERNAME") || "",
      password: cfg?.password || Deno.env.get("FTP_PASSWORD") || "",
      basePath: cfg?.base_path || Deno.env.get("FTP_BASE_PATH") || "/uploads",
      publicBase: cfg?.public_url || Deno.env.get("FTP_PUBLIC_URL") || "",
    }

    // Caminho relativo: {organization_id}/{ordem_servico_id}/{arquivo}
        // Força extensão .jpg (o front já comprime em JPEG) para evitar que um nome
        // malicioso termine como script executável dentro da pasta pública.
        const timestamp = Date.now()
        const baseName = (file.name || "foto")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 60) || "foto"
        const fileName = `${timestamp}_${baseName}.jpg`
        const relativePath = `${profile.organization_id}/${ordemServicoId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    let publicUrl: string
    if (config.httpUploadUrl && config.httpUploadSecret) {
      publicUrl = await uploadViaHttp(config, relativePath, fileData, file.type || "image/jpeg", fileName)
    } else if (config.host && config.username && config.password) {
      publicUrl = await uploadViaFtp(config, relativePath, fileData)
    } else {
      console.error("[ftp-upload] nenhum destino configurado")
      return new Response(
        JSON.stringify({ error: "Upload não configurado (nem HTTP nem FTP)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

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
    return new Response(JSON.stringify({ error: error?.message || "Falha no upload" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})