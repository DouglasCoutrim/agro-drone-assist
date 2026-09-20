import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type AppRole = 'admin' | 'tecnico' | 'consulta';

// Sanitize search input to prevent PostgREST filter injection
function sanitizeSearch(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9\s@.\-_()áéíóúãõçÀ-ÿ]/g, '')
    .slice(0, 100);
}

async function getUserRole(supabase: any, userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  return data?.role || null;
}

async function getUserOrg(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();
  return data?.organization_id || null;
}

function forbidden() {
  return new Response(
    JSON.stringify({ error: 'Forbidden: insufficient permissions' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function unauthorized() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const resource = pathParts[1];
  const resourceId = pathParts[2];

  // Authenticate user
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;
  let userRole: AppRole | null = null;
  let userOrg: string | null = null;

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return unauthorized();
    }
    userId = data.claims.sub as string;
    userRole = await getUserRole(supabase, userId);
    userOrg = await getUserOrg(supabase, userId);
  }

  // Health endpoint is public
  if (resource === 'health') {
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // All other endpoints require authentication
  if (!userId || !userOrg) {
    return unauthorized();
  }

  console.log(`API Request: ${req.method} /${resource}${resourceId ? '/' + resourceId : ''} by user=${userId} role=${userRole} org=${userOrg}`);

  try {
    switch (resource) {
      case 'clientes':
        return await handleClientes(req, supabase, userRole, userOrg, resourceId);
      
      case 'ordens-servico':
        return await handleOrdensServico(req, supabase, userRole, userOrg, resourceId);
      
      case 'estoque':
        return await handleEstoque(req, supabase, userRole, userOrg, resourceId);
      
      case 'financeiro':
        return await handleFinanceiro(req, supabase, userRole, userOrg, resourceId);
      
      case 'dashboard':
        return await handleDashboard(supabase, userRole, userOrg);

      default:
        return new Response(
          JSON.stringify({ error: 'Resource not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleClientes(req: Request, supabase: any, role: AppRole | null, orgId: string | null, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();

    if (id) {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: 'Cliente não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const rawSearch = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('clientes').select('*', { count: 'exact' }).eq('organization_id', orgId);
    if (rawSearch) {
      const search = sanitizeSearch(rawSearch);
      if (search.length > 0) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,cpf_cnpj.ilike.%${search}%`);
      }
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return new Response(JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'POST') {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    body.organization_id = orgId;
    const { data, error } = await supabase.from('clientes').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'PUT' && id) {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    body.organization_id = orgId;
    const { data, error } = await supabase.from('clientes').update(body).eq('id', id).eq('organization_id', orgId).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'DELETE' && id) {
    if (role !== 'admin') return forbidden();
    const { error } = await supabase.from('clientes').delete().eq('id', id).eq('organization_id', orgId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleOrdensServico(req: Request, supabase: any, role: AppRole | null, orgId: string | null, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (id) {
      const { data, error } = await supabase.from('ordens_servico')
        .select(`*, cliente:clientes(*), tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome, email)`)
        .eq('id', id).eq('organization_id', orgId).maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: 'Ordem de serviço não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const rawSearch = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('ordens_servico')
      .select(`*, cliente:clientes(id, nome, telefone), tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome)`, { count: 'exact' })
      .eq('organization_id', orgId);
    if (status) query = query.eq('status', status);
    if (rawSearch) {
      const search = sanitizeSearch(rawSearch);
      if (search.length > 0) {
        query = query.or(`numero.ilike.%${search}%,descricao_problema.ilike.%${search}%`);
      }
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return new Response(JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'POST') {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    body.organization_id = orgId;
    const { data, error } = await supabase.from('ordens_servico').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'PUT' && id) {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    const { data, error } = await supabase.from('ordens_servico').update(body).eq('id', id).eq('organization_id', orgId).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'DELETE' && id) {
    if (role !== 'admin') return forbidden();
    const { error } = await supabase.from('ordens_servico').delete().eq('id', id).eq('organization_id', orgId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleEstoque(req: Request, supabase: any, role: AppRole | null, orgId: string | null, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (id) {
      const { data, error } = await supabase.from('itens_estoque').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: 'Item não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const categoria = url.searchParams.get('categoria');
    const rawSearch = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('itens_estoque').select('*', { count: 'exact' }).eq('organization_id', orgId);
    if (categoria) query = query.eq('categoria', categoria);
    if (rawSearch) {
      const search = sanitizeSearch(rawSearch);
      if (search.length > 0) {
        query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
      }
    }

    const { data, error, count } = await query.order('descricao', { ascending: true }).range(offset, offset + limit - 1);
    if (error) throw error;
    return new Response(JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'POST') {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    body.organization_id = orgId;
    const { data, error } = await supabase.from('itens_estoque').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'PUT' && id) {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();
    const body = await req.json();
    const { data, error } = await supabase.from('itens_estoque').update(body).eq('id', id).eq('organization_id', orgId).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'DELETE' && id) {
    if (role !== 'admin') return forbidden();
    const { error } = await supabase.from('itens_estoque').delete().eq('id', id).eq('organization_id', orgId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleFinanceiro(req: Request, supabase: any, role: AppRole | null, orgId: string | null, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (!role || !['admin', 'tecnico'].includes(role)) return forbidden();

    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo');
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('financeiro').select('*', { count: 'exact' }).eq('organization_id', orgId);
    if (tipo) query = query.eq('tipo', tipo);
    if (dataInicio) query = query.gte('data_transacao', dataInicio);
    if (dataFim) query = query.lte('data_transacao', dataFim);

    const { data, error, count } = await query.order('data_transacao', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return new Response(JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (method === 'POST') {
    if (role !== 'admin') return forbidden();
    const body = await req.json();
    body.organization_id = orgId;
    const { data, error } = await supabase.from('financeiro').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDashboard(supabase: any, role: AppRole | null, orgId: string | null) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const { count: osAbertas } = await supabase.from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', ['aberta', 'em_andamento', 'aguardando_peca']);

  const { count: osConcluidas } = await supabase.from('ordens_servico')
    .select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'concluida');

  const { count: osHoje } = await supabase.from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', today.toISOString().split('T')[0]);

  const { data: lowStock } = await supabase.from('itens_estoque').select('id, quantidade, estoque_minimo').eq('organization_id', orgId);
  const lowStockCount = lowStock?.filter((i: any) => i.quantidade <= i.estoque_minimo).length || 0;

  let receitaMensal = 0;
  if (role && ['admin', 'tecnico'].includes(role)) {
    const { data: receitas } = await supabase.from('financeiro').select('valor')
      .eq('organization_id', orgId)
      .eq('tipo', 'receita').gte('data_transacao', startOfMonth).lte('data_transacao', endOfMonth);
    receitaMensal = receitas?.reduce((acc: number, r: any) => acc + parseFloat(r.valor), 0) || 0;
  }

  return new Response(
    JSON.stringify({
      os_abertas: osAbertas || 0,
      os_concluidas: osConcluidas || 0,
      os_hoje: osHoje || 0,
      itens_baixo_estoque: lowStockCount,
      receita_mensal: receitaMensal,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
