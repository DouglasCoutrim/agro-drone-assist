import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/**
 * Upload de anexos da OS.
 *
 * O nome "ftp-upload" é histórico: a função nasceu enviando a imagem para um
 * script PHP / servidor FTP na hospedagem antiga. O domínio livreos.net passou a
 * servir o próprio SPA, então https://livreos.net/upload-os-image.php devolvia o
 * index.html do sistema (HTTP 200 com HTML) e o JSON.parse quebrava com
 * "Resposta inválida do servidor PHP". O destino passou a ser o bucket privado
 * `os-anexos` do Supabase Storage, que já existia com policies escopadas por
 * organização. A tabela `public.ftp_config` não é mais lida por esta função.
 *
 * O que fica gravado em `public.os_anexos.url` é o CAMINHO do objeto dentro do
 * bucket (`{organization_id}/{ordem_servico_id}/{arquivo}.jpg`), não uma URL
 * pública — o bucket é privado e a tela assina a leitura na hora.
 *
 * O upload usa o token do próprio usuário (não a service role), para que a
 * policy de INSERT do bucket valide a organização e o papel.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'os-anexos'

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

    // Verifica que a OS é da organização do usuário antes de gravar qualquer coisa.
    // Usa a service role de propósito: o filtro por organization_id já garante o
    // limite entre empresas, e assim a regra de visibilidade de OS (que pode
    // esconder a OS de outro técnico) não gera um 404 falso aqui.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const { data: os } = await admin
      .from("ordens_servico")
      .select("id, organization_id")
      .eq("id", ordemServicoId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle()

    if (!os) {
      return new Response(
        JSON.stringify({ error: "Ordem de serviço não encontrada nesta empresa." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Caminho relativo: {organization_id}/{ordem_servico_id}/{arquivo}
    // Força extensão .jpg (o front já comprime em JPEG) para evitar que um nome
    // malicioso termine como script executável dentro do bucket.
    const timestamp = Date.now()
    const baseName = (file.name || "foto")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60) || "foto"
    const fileName = `${timestamp}_${baseName}.jpg`
    const path = `${profile.organization_id}/${ordemServicoId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(arrayBuffer), {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      })

    if (uploadError) {
      console.error("[ftp-upload] falha no Storage", { path, error: uploadError.message })
      return new Response(
        JSON.stringify({ error: "Falha ao enviar a imagem: " + uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { error: insertError } = await supabase.from("os_anexos").insert({
      ordem_servico_id: ordemServicoId,
      organization_id: profile.organization_id,
      nome_arquivo: fileName,
      url: path,
      tipo: "image/jpeg",
      tamanho: file.size,
      usuario_id: user.id,
      descricao: descricao,
    })

    if (insertError) {
      // Não deixa objeto órfão no bucket se o registro não entrou.
      await supabase.storage.from(BUCKET).remove([path])
      console.error("[ftp-upload] falha ao salvar registro", { error: insertError.message })
      return new Response(
        JSON.stringify({ error: "Upload concluído, mas o registro não foi salvo: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    console.log("[ftp-upload] anexo gravado", { path, bytes: file.size })

    return new Response(JSON.stringify({ url: path, path, fileName }), {
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
