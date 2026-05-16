export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          asaas_id: string | null
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          organization_id: string | null
          telefone: string
          updated_at: string
        }
        Insert: {
          asaas_id?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          organization_id?: string | null
          telefone: string
          updated_at?: string
        }
        Update: {
          asaas_id?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string | null
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          dominio_personalizado: string | null
          email_remetente: string | null
          endereco: string | null
          favicon_url: string | null
          gateway_clientes: string
          gateway_clientes_credentials: Json
          gateway_credentials: Json | null
          gateway_pagamento: string | null
          id: string
          logo_url: string | null
          nome_empresa: string
          organization_id: string | null
          owner_id: string | null
          responsavel: string | null
          subdominio: string | null
          telefone: string | null
          termos_servico: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          dominio_personalizado?: string | null
          email_remetente?: string | null
          endereco?: string | null
          favicon_url?: string | null
          gateway_clientes?: string
          gateway_clientes_credentials?: Json
          gateway_credentials?: Json | null
          gateway_pagamento?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string
          organization_id?: string | null
          owner_id?: string | null
          responsavel?: string | null
          subdominio?: string | null
          telefone?: string | null
          termos_servico?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          dominio_personalizado?: string | null
          email_remetente?: string | null
          endereco?: string | null
          favicon_url?: string | null
          gateway_clientes?: string
          gateway_clientes_credentials?: Json
          gateway_credentials?: Json | null
          gateway_pagamento?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string
          organization_id?: string | null
          owner_id?: string | null
          responsavel?: string | null
          subdominio?: string | null
          telefone?: string | null
          termos_servico?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro: {
        Row: {
          categoria: string | null
          created_at: string
          data_transacao: string
          descricao: string
          id: string
          observacoes: string | null
          ordem_servico_id: string | null
          organization_id: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_transacao?: string
          descricao: string
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string | null
          organization_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_transacao?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string | null
          organization_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_estoque: {
        Row: {
          categoria: string
          codigo: string
          created_at: string
          custo_unitario: number
          descricao: string
          estoque_minimo: number
          fornecedor: string | null
          id: string
          localizacao: string | null
          organization_id: string | null
          preco_venda: number
          quantidade: number
          updated_at: string
        }
        Insert: {
          categoria: string
          codigo: string
          created_at?: string
          custo_unitario?: number
          descricao: string
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          localizacao?: string | null
          organization_id?: string | null
          preco_venda?: number
          quantidade?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          codigo?: string
          created_at?: string
          custo_unitario?: number
          descricao?: string
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          localizacao?: string | null
          organization_id?: string | null
          preco_venda?: number
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_estoque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_os: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem_servico_id: string
          organization_id: string | null
          produto_id: string | null
          quantidade: number
          servico_id: string | null
          tipo: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          ordem_servico_id: string
          organization_id?: string | null
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          tipo?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem_servico_id?: string
          organization_id?: string | null
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          tipo?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_os_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_os_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_os_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_os_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          id: string
          item_id: string
          motivo: string | null
          ordem_servico_id: string | null
          organization_id: string | null
          quantidade: number
          tipo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          motivo?: string | null
          ordem_servico_id?: string | null
          organization_id?: string | null
          quantidade: number
          tipo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          motivo?: string | null
          ordem_servico_id?: string | null
          organization_id?: string | null
          quantidade?: number
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string
          created_at: string
          desconto: number
          descricao: string
          equipamento: string
          id: string
          itens: Json
          ordem_servico_id: string | null
          organization_id: string | null
          status: string
          updated_at: string
          validade: string
          valor: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          desconto?: number
          descricao?: string
          equipamento?: string
          id?: string
          itens?: Json
          ordem_servico_id?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          validade?: string
          valor?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          desconto?: number
          descricao?: string
          equipamento?: string
          id?: string
          itens?: Json
          ordem_servico_id?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          validade?: string
          valor?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          checklist_bateria: boolean | null
          checklist_cabos: boolean | null
          checklist_carregador: boolean | null
          checklist_controle: boolean | null
          checklist_helices: boolean | null
          checklist_outros: boolean | null
          ciclos_carga_entrada: number | null
          ciclos_carga_saida: number | null
          cliente_id: string
          condicao_visual: string | null
          created_at: string
          custo_mao_obra: number | null
          custo_pecas: number | null
          data_conclusao: string | null
          data_entrada: string
          data_entrega: string | null
          data_previsao: string | null
          desconto: number
          descricao_problema: string
          diagnostico: string | null
          id: string
          marca: string | null
          modelo_equipamento: string | null
          numero: string
          numero_serie: string | null
          observacoes: string | null
          organization_id: string | null
          prioridade: string
          solucao: string | null
          status: Database["public"]["Enums"]["status_os"]
          tecnico_id: string | null
          tipo_equipamento: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at: string
          valor_final: number | null
          valor_orcamento: number | null
        }
        Insert: {
          checklist_bateria?: boolean | null
          checklist_cabos?: boolean | null
          checklist_carregador?: boolean | null
          checklist_controle?: boolean | null
          checklist_helices?: boolean | null
          checklist_outros?: boolean | null
          ciclos_carga_entrada?: number | null
          ciclos_carga_saida?: number | null
          cliente_id: string
          condicao_visual?: string | null
          created_at?: string
          custo_mao_obra?: number | null
          custo_pecas?: number | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          data_previsao?: string | null
          desconto?: number
          descricao_problema: string
          diagnostico?: string | null
          id?: string
          marca?: string | null
          modelo_equipamento?: string | null
          numero: string
          numero_serie?: string | null
          observacoes?: string | null
          organization_id?: string | null
          prioridade?: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["status_os"]
          tecnico_id?: string | null
          tipo_equipamento: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at?: string
          valor_final?: number | null
          valor_orcamento?: number | null
        }
        Update: {
          checklist_bateria?: boolean | null
          checklist_cabos?: boolean | null
          checklist_carregador?: boolean | null
          checklist_controle?: boolean | null
          checklist_helices?: boolean | null
          checklist_outros?: boolean | null
          ciclos_carga_entrada?: number | null
          ciclos_carga_saida?: number | null
          cliente_id?: string
          condicao_visual?: string | null
          created_at?: string
          custo_mao_obra?: number | null
          custo_pecas?: number | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          data_previsao?: string | null
          desconto?: number
          descricao_problema?: string
          diagnostico?: string | null
          id?: string
          marca?: string | null
          modelo_equipamento?: string | null
          numero?: string
          numero_serie?: string | null
          observacoes?: string | null
          organization_id?: string | null
          prioridade?: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["status_os"]
          tecnico_id?: string | null
          tipo_equipamento?: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at?: string
          valor_final?: number | null
          valor_orcamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          billing_cycle: string
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          cycle_discount: number
          id: string
          max_os_per_month: number
          max_users: number
          monthly_fee: number
          name: string
          next_due_date: string | null
          owner_id: string
          plan: string
          settings: Json | null
          slug: string
          status: string
          telefone: string | null
          trial_ends_at: string | null
        }
        Insert: {
          active?: boolean
          billing_cycle?: string
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          cycle_discount?: number
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_fee?: number
          name: string
          next_due_date?: string | null
          owner_id: string
          plan?: string
          settings?: Json | null
          slug: string
          status?: string
          telefone?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          cycle_discount?: number
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_fee?: number
          name?: string
          next_due_date?: string | null
          owner_id?: string
          plan?: string
          settings?: Json | null
          slug?: string
          status?: string
          telefone?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      os_anexos: {
        Row: {
          created_at: string
          id: string
          nome_arquivo: string
          ordem_servico_id: string
          organization_id: string | null
          tamanho: number | null
          tipo: string | null
          url: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome_arquivo: string
          ordem_servico_id: string
          organization_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          url: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_arquivo?: string
          ordem_servico_id?: string
          organization_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          url?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_anexos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_anexos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      os_historico: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          id: string
          ordem_servico_id: string
          organization_id: string | null
          usuario_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          ordem_servico_id: string
          organization_id?: string | null
          usuario_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          ordem_servico_id?: string
          organization_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_historico_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_historico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          categoria: string | null
          codigo: string | null
          created_at: string
          custo_unitario: number
          descricao: string
          id: string
          organization_id: string | null
          preco_venda: number
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          custo_unitario?: number
          descricao: string
          id?: string
          organization_id?: string | null
          preco_venda?: number
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          custo_unitario?: number
          descricao?: string
          id?: string
          organization_id?: string | null
          preco_venda?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          organization_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          organization_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          organization_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          cliente_id: string
          created_at: string
          custo_rota: number
          destino: string
          distancia_km: number
          id: string
          observacoes: string | null
          organization_id: string | null
          origem: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          custo_rota?: number
          destino?: string
          distancia_km?: number
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          origem?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          custo_rota?: number
          destino?: string
          distancia_km?: number
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          origem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          organization_id: string | null
          preco: number
          tempo_estimado: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          organization_id?: string | null
          preco?: number
          tempo_estimado?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          organization_id?: string | null
          preco?: number
          tempo_estimado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          max_os_per_month: number
          max_users: number
          monthly_price: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_price?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_invoices: {
        Row: {
          asaas_charge_id: string | null
          competencia: string
          created_at: string
          id: string
          organization_id: string
          pago_em: string | null
          payment_url: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          asaas_charge_id?: string | null
          competencia: string
          created_at?: string
          id?: string
          organization_id: string
          pago_em?: string | null
          payment_url?: string | null
          status?: string
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          asaas_charge_id?: string | null
          competencia?: string
          created_at?: string
          id?: string
          organization_id?: string
          pago_em?: string | null
          payment_url?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          acesso_estoque: boolean
          acesso_financeiro: boolean
          acesso_os: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acesso_estoque?: boolean
          acesso_financeiro?: boolean
          acesso_os?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acesso_estoque?: boolean
          acesso_financeiro?: boolean
          acesso_os?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_active_users: { Args: { _org: string }; Returns: number }
      count_os_current_month: { Args: { _org: string }; Returns: number }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_tecnico: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "consulta"
      status_os:
        | "aberta"
        | "em_andamento"
        | "aguardando_peca"
        | "concluida"
        | "entregue"
        | "cancelada"
        | "recebido"
        | "aguardando_diagnostico"
        | "aguardando_aprovacao"
        | "aprovado"
        | "em_reparo"
        | "em_testes"
        | "pronto_retirada"
      tipo_equipamento:
        | "drone_agricola"
        | "drone_convencional"
        | "controle"
        | "bateria"
        | "outro"
      tipo_transacao: "receita" | "despesa" | "salario" | "comissao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tecnico", "consulta"],
      status_os: [
        "aberta",
        "em_andamento",
        "aguardando_peca",
        "concluida",
        "entregue",
        "cancelada",
        "recebido",
        "aguardando_diagnostico",
        "aguardando_aprovacao",
        "aprovado",
        "em_reparo",
        "em_testes",
        "pronto_retirada",
      ],
      tipo_equipamento: [
        "drone_agricola",
        "drone_convencional",
        "controle",
        "bateria",
        "outro",
      ],
      tipo_transacao: ["receita", "despesa", "salario", "comissao"],
    },
  },
} as const
