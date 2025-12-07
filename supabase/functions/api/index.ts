import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const resource = pathParts[1]; // After 'api'
  const resourceId = pathParts[2];

  // Get authorization header for user context
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id || null;
  }

  console.log(`API Request: ${req.method} /${resource}${resourceId ? '/' + resourceId : ''}`);

  try {
    switch (resource) {
      case 'clientes':
        return await handleClientes(req, supabase, resourceId);
      
      case 'ordens-servico':
        return await handleOrdensServico(req, supabase, resourceId);
      
      case 'estoque':
        return await handleEstoque(req, supabase, resourceId);
      
      case 'financeiro':
        return await handleFinanceiro(req, supabase, resourceId);
      
      case 'dashboard':
        return await handleDashboard(supabase);
      
      case 'health':
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Resource not found',
            available_endpoints: [
              'GET /api/health',
              'GET/POST /api/clientes',
              'GET/PUT/DELETE /api/clientes/:id',
              'GET/POST /api/ordens-servico',
              'GET/PUT/DELETE /api/ordens-servico/:id',
              'GET/POST /api/estoque',
              'GET/PUT/DELETE /api/estoque/:id',
              'GET/POST /api/financeiro',
              'GET /api/dashboard'
            ]
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleClientes(req: Request, supabase: any, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (id) {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(data), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('clientes').select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,cpf_cnpj.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return new Response(
      JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'POST') {
    const body = await req.json();
    const { data, error } = await supabase.from('clientes').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      status: 201, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'PUT' && id) {
    const body = await req.json();
    const { data, error } = await supabase.from('clientes').update(body).eq('id', id).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'DELETE' && id) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleOrdensServico(req: Request, supabase: any, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (id) {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          cliente:clientes(*),
          tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome, email)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Ordem de serviço não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(data), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('ordens_servico')
      .select(`
        *,
        cliente:clientes(id, nome, telefone),
        tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`numero.ilike.%${search}%,descricao_problema.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return new Response(
      JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'POST') {
    const body = await req.json();
    const { data, error } = await supabase.from('ordens_servico').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      status: 201, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'PUT' && id) {
    const body = await req.json();
    const { data, error } = await supabase.from('ordens_servico').update(body).eq('id', id).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'DELETE' && id) {
    const { error } = await supabase.from('ordens_servico').delete().eq('id', id);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleEstoque(req: Request, supabase: any, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    if (id) {
      const { data, error } = await supabase
        .from('itens_estoque')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Item não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(data), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = new URL(req.url);
    const categoria = url.searchParams.get('categoria');
    const baixoEstoque = url.searchParams.get('baixo_estoque') === 'true';
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('itens_estoque').select('*', { count: 'exact' });

    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    if (baixoEstoque) {
      query = query.lte('quantidade', supabase.raw('estoque_minimo'));
    }

    if (search) {
      query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('descricao', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return new Response(
      JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'POST') {
    const body = await req.json();
    const { data, error } = await supabase.from('itens_estoque').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      status: 201, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'PUT' && id) {
    const body = await req.json();
    const { data, error } = await supabase.from('itens_estoque').update(body).eq('id', id).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (method === 'DELETE' && id) {
    const { error } = await supabase.from('itens_estoque').delete().eq('id', id);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleFinanceiro(req: Request, supabase: any, id?: string) {
  const method = req.method;

  if (method === 'GET') {
    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo');
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase.from('financeiro').select('*', { count: 'exact' });

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (dataInicio) {
      query = query.gte('data_transacao', dataInicio);
    }

    if (dataFim) {
      query = query.lte('data_transacao', dataFim);
    }

    const { data, error, count } = await query
      .order('data_transacao', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return new Response(
      JSON.stringify({ data, total: count, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'POST') {
    const body = await req.json();
    const { data, error } = await supabase.from('financeiro').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { 
      status: 201, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleDashboard(supabase: any) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  // Get OS stats
  const { data: osStats } = await supabase
    .from('ordens_servico')
    .select('status', { count: 'exact' });

  const { count: osAbertas } = await supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .in('status', ['aberta', 'em_andamento', 'aguardando_peca']);

  const { count: osConcluidas } = await supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'concluida');

  const { count: osHoje } = await supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString().split('T')[0]);

  // Get low stock items
  const { data: lowStock } = await supabase
    .from('itens_estoque')
    .select('*')
    .lte('quantidade', supabase.raw('estoque_minimo'));

  // Get monthly revenue
  const { data: receitas } = await supabase
    .from('financeiro')
    .select('valor')
    .eq('tipo', 'receita')
    .gte('data_transacao', startOfMonth)
    .lte('data_transacao', endOfMonth);

  const receitaMensal = receitas?.reduce((acc: number, r: any) => acc + parseFloat(r.valor), 0) || 0;

  return new Response(
    JSON.stringify({
      os_abertas: osAbertas || 0,
      os_concluidas: osConcluidas || 0,
      os_hoje: osHoje || 0,
      itens_baixo_estoque: lowStock?.length || 0,
      receita_mensal: receitaMensal,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
