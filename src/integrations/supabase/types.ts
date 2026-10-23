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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          organization_id: string | null
          performed_by: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          performed_by?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          performed_by?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_equipamento_itens: {
        Row: {
          created_at: string
          id: string
          label: string
          obrigatorio: boolean
          ordem: number
          organization_id: string
          tipo_equipamento_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          obrigatorio?: boolean
          ordem?: number
          organization_id: string
          tipo_equipamento_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          obrigatorio?: boolean
          ordem?: number
          organization_id?: string
          tipo_equipamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_equipamento_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_equipamento_itens_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "checklist_tipos_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tipos_equipamento: {
        Row: {
          ativo: boolean
          created_at: string
          db_enum: string
          descricao: string | null
          id: string
          label: string
          organization_id: string
          updated_at: string
          value: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          db_enum?: string
          descricao?: string | null
          id?: string
          label: string
          organization_id: string
          updated_at?: string
          value: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          db_enum?: string
          descricao?: string | null
          id?: string
          label?: string
          organization_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tipos_equipamento_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          asaas_id: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_municipio: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          indicador_ie: number
          inscricao_estadual: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          organization_id: string | null
          telefone: string
          updated_at: string
        }
        Insert: {
          asaas_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicador_ie?: number
          inscricao_estadual?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          organization_id?: string | null
          telefone: string
          updated_at?: string
        }
        Update: {
          asaas_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicador_ie?: number
          inscricao_estadual?: string | null
          nome?: string
          numero?: string | null
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
      contas_pagar: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          fornecedor_id: string | null
          id: string
          organization_id: string
          periodicidade: string | null
          recorrente: boolean
          status: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          fornecedor_id?: string | null
          id?: string
          organization_id: string
          periodicidade?: string | null
          recorrente?: boolean
          status?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          fornecedor_id?: string | null
          id?: string
          organization_id?: string
          periodicidade?: string | null
          recorrente?: boolean
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_organization_id_fkey"
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
          organization_id: string
          owner_id: string | null
          responsavel: string | null
          subdominio: string | null
          telefone: string | null
          termos_servico: string | null
          updated_at: string
          valor_hora_padrao: number
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
          organization_id: string
          owner_id?: string | null
          responsavel?: string | null
          subdominio?: string | null
          telefone?: string | null
          termos_servico?: string | null
          updated_at?: string
          valor_hora_padrao?: number
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
          organization_id?: string
          owner_id?: string | null
          responsavel?: string | null
          subdominio?: string | null
          telefone?: string | null
          termos_servico?: string | null
          updated_at?: string
          valor_hora_padrao?: number
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
      empresa_gateway_credenciais: {
        Row: {
          chave_json: Json
          created_at: string
          criado_por: string | null
          gateway_tipo: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          chave_json?: Json
          created_at?: string
          criado_por?: string | null
          gateway_tipo: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          chave_json?: Json
          created_at?: string
          criado_por?: string | null
          gateway_tipo?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_gateway_credenciais_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_tecnico: {
        Row: {
          id: string
          item_estoque_id: string
          organization_id: string
          quantidade: number
          tecnico_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_estoque_id: string
          organization_id: string
          quantidade?: number
          tecnico_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_estoque_id?: string
          organization_id?: string
          quantidade?: number
          tecnico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_tecnico_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_tecnico_organization_id_fkey"
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
      fiscal_company_config: {
        Row: {
          ambiente: string
          certificate_a1_url: string | null
          cnpj: string
          created_at: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          organization_id: string
          regime_tributario: string
          updated_at: string | null
        }
        Insert: {
          ambiente?: string
          certificate_a1_url?: string | null
          cnpj: string
          created_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          organization_id: string
          regime_tributario?: string
          updated_at?: string | null
        }
        Update: {
          ambiente?: string
          certificate_a1_url?: string | null
          cnpj?: string
          created_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          organization_id?: string
          regime_tributario?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_company_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          chave_acesso: string | null
          created_at: string | null
          emissao_at: string | null
          id: string
          motivo_rejeicao: string | null
          numero: string | null
          ordem_servico_id: string | null
          organization_id: string
          payload_envio: Json | null
          payload_retorno: Json | null
          serie: string | null
          status: Database["public"]["Enums"]["fiscal_doc_status"]
          type: Database["public"]["Enums"]["fiscal_doc_type"]
          updated_at: string | null
          url_pdf: string | null
          url_xml: string | null
          valor_total: number
        }
        Insert: {
          chave_acesso?: string | null
          created_at?: string | null
          emissao_at?: string | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          ordem_servico_id?: string | null
          organization_id: string
          payload_envio?: Json | null
          payload_retorno?: Json | null
          serie?: string | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          type: Database["public"]["Enums"]["fiscal_doc_type"]
          updated_at?: string | null
          url_pdf?: string | null
          url_xml?: string | null
          valor_total?: number
        }
        Update: {
          chave_acesso?: string | null
          created_at?: string | null
          emissao_at?: string | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          ordem_servico_id?: string | null
          organization_id?: string
          payload_envio?: Json | null
          payload_retorno?: Json | null
          serie?: string | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          type?: Database["public"]["Enums"]["fiscal_doc_type"]
          updated_at?: string | null
          url_pdf?: string | null
          url_xml?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          bairro: string
          cep: string
          cidade: string
          complemento: string
          contato: string
          cpf_cnpj: string
          created_at: string
          email: string
          endereco: string
          estado: string
          id: string
          inscricao_estadual: string
          nome: string
          nome_fantasia: string
          numero: string
          observacoes: string
          organization_id: string
          telefone: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          contato?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_estadual?: string
          nome: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          organization_id: string
          telefone?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          contato?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_estadual?: string
          nome?: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          organization_id?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_organization_id_fkey"
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
          cest: string | null
          cfop: string
          codigo: string
          created_at: string
          csosn: string
          cst_icms: string | null
          custo_unitario: number
          descricao: string
          estoque_minimo: number
          fornecedor: string | null
          gtin: string | null
          id: string
          localizacao: string | null
          ncm: string | null
          organization_id: string | null
          origem: number
          preco_venda: number
          quantidade: number
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria: string
          cest?: string | null
          cfop?: string
          codigo: string
          created_at?: string
          csosn?: string
          cst_icms?: string | null
          custo_unitario?: number
          descricao: string
          estoque_minimo?: number
          fornecedor?: string | null
          gtin?: string | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          organization_id?: string | null
          origem?: number
          preco_venda?: number
          quantidade?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          cest?: string | null
          cfop?: string
          codigo?: string
          created_at?: string
          csosn?: string
          cst_icms?: string | null
          custo_unitario?: number
          descricao?: string
          estoque_minimo?: number
          fornecedor?: string | null
          gtin?: string | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          organization_id?: string | null
          origem?: number
          preco_venda?: number
          quantidade?: number
          unidade?: string
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
          item_estoque_id: string | null
          ordem_servico_id: string
          organization_id: string | null
          produto_id: string | null
          quantidade: number
          servico_id: string | null
          snapshot_tipo_cobranca: string
          snapshot_valor_hora_efetivo: number | null
          tipo: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          item_estoque_id?: string | null
          ordem_servico_id: string
          organization_id?: string | null
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          snapshot_tipo_cobranca?: string
          snapshot_valor_hora_efetivo?: number | null
          tipo?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          item_estoque_id?: string | null
          ordem_servico_id?: string
          organization_id?: string | null
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          snapshot_tipo_cobranca?: string
          snapshot_valor_hora_efetivo?: number | null
          tipo?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_os_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
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
      nfe_config: {
        Row: {
          ambiente: string
          bairro: string | null
          cep: string | null
          cnpj: string | null
          codigo_municipio: string | null
          complemento: string | null
          created_at: string
          focus_token_homologacao: string | null
          focus_token_producao: string | null
          habilitado: boolean
          id: string
          informacoes_complementares: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          municipio: string | null
          natureza_operacao: string
          nfse_aliquota: number
          nfse_codigo_cnae: string | null
          nfse_codigo_tributario_municipio: string | null
          nfse_discriminacao_padrao: string | null
          nfse_habilitado: boolean
          nfse_iss_retido: boolean
          nfse_item_lista_servico: string | null
          nfse_natureza_operacao: string
          nome_fantasia: string | null
          numero: string | null
          organization_id: string
          proximo_numero: number
          razao_social: string | null
          regime_tributario: number
          serie: number
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          created_at?: string
          focus_token_homologacao?: string | null
          focus_token_producao?: string | null
          habilitado?: boolean
          id?: string
          informacoes_complementares?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          municipio?: string | null
          natureza_operacao?: string
          nfse_aliquota?: number
          nfse_codigo_cnae?: string | null
          nfse_codigo_tributario_municipio?: string | null
          nfse_discriminacao_padrao?: string | null
          nfse_habilitado?: boolean
          nfse_iss_retido?: boolean
          nfse_item_lista_servico?: string | null
          nfse_natureza_operacao?: string
          nome_fantasia?: string | null
          numero?: string | null
          organization_id: string
          proximo_numero?: number
          razao_social?: string | null
          regime_tributario?: number
          serie?: number
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          created_at?: string
          focus_token_homologacao?: string | null
          focus_token_producao?: string | null
          habilitado?: boolean
          id?: string
          informacoes_complementares?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          municipio?: string | null
          natureza_operacao?: string
          nfse_aliquota?: number
          nfse_codigo_cnae?: string | null
          nfse_codigo_tributario_municipio?: string | null
          nfse_discriminacao_padrao?: string | null
          nfse_habilitado?: boolean
          nfse_iss_retido?: boolean
          nfse_item_lista_servico?: string | null
          nfse_natureza_operacao?: string
          nome_fantasia?: string | null
          numero?: string | null
          organization_id?: string
          proximo_numero?: number
          razao_social?: string | null
          regime_tributario?: number
          serie?: number
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfe_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_emitida: {
        Row: {
          ambiente: string
          cancelada_em: string | null
          cancelada_por: string | null
          chave_acesso: string | null
          cliente_cpf_cnpj: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          emitida_em: string
          emitida_por: string | null
          id: string
          motivo_rejeicao: string | null
          numero: string | null
          organization_id: string
          os_id: string | null
          payload_envio: Json | null
          payload_retorno: Json | null
          pdf_url: string | null
          protocolo: string | null
          provider: string
          provider_id: string | null
          referencia: string
          serie: string | null
          status: string
          tipo: string
          updated_at: string
          valor_impostos: number | null
          valor_liquido: number | null
          valor_total: number | null
          venda_id: string | null
          xml_conteudo: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          chave_acesso?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          emitida_em?: string
          emitida_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          organization_id: string
          os_id?: string | null
          payload_envio?: Json | null
          payload_retorno?: Json | null
          pdf_url?: string | null
          protocolo?: string | null
          provider?: string
          provider_id?: string | null
          referencia: string
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_impostos?: number | null
          valor_liquido?: number | null
          valor_total?: number | null
          venda_id?: string | null
          xml_conteudo?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          chave_acesso?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          emitida_em?: string
          emitida_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          numero?: string | null
          organization_id?: string
          os_id?: string | null
          payload_envio?: Json | null
          payload_retorno?: Json | null
          pdf_url?: string | null
          protocolo?: string | null
          provider?: string
          provider_id?: string | null
          referencia?: string
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_impostos?: number | null
          valor_liquido?: number | null
          valor_total?: number | null
          venda_id?: string | null
          xml_conteudo?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_emitida_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_emitida_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_eventos: {
        Row: {
          created_at: string
          dados_evento: Json | null
          descricao: string | null
          id: string
          nf_id: string
          tipo_evento: string | null
        }
        Insert: {
          created_at?: string
          dados_evento?: Json | null
          descricao?: string | null
          id?: string
          nf_id: string
          tipo_evento?: string | null
        }
        Update: {
          created_at?: string
          dados_evento?: Json | null
          descricao?: string | null
          id?: string
          nf_id?: string
          tipo_evento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_eventos_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "nota_fiscal_emitida"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_itens: {
        Row: {
          cfop: string | null
          created_at: string
          descricao: string
          id: string
          ncm: string | null
          nf_id: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          created_at?: string
          descricao: string
          id?: string
          ncm?: string | null
          nf_id: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Update: {
          cfop?: string | null
          created_at?: string
          descricao?: string
          id?: string
          ncm?: string | null
          nf_id?: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "nota_fiscal_emitida"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          checklist_equipamento_tipo_id: string | null
          checklist_helices: boolean | null
          checklist_outros: boolean | null
          ciclos_carga_entrada: number | null
          ciclos_carga_saida: number | null
          cliente_id: string
          commission_assistants_computed_at: string | null
          commission_assistants_fixed: number
          commission_assistants_percentage: number
          commission_assistants_total: number
          commission_computed_at: string | null
          commission_products: number
          commission_services: number
          commission_total: number
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
          nfe_emitida: boolean | null
          nfse_numero: string | null
          numero: string
          numero_serie: string | null
          observacoes: string | null
          organization_id: string | null
          prioridade: string
          solucao: string | null
          status: Database["public"]["Enums"]["status_os"]
          tecnico_id: string | null
          tipo_equipamento: Database["public"]["Enums"]["tipo_equipamento"]
          tipo_os: Database["public"]["Enums"]["tipo_os"] | null
          updated_at: string
          valor_final: number | null
          valor_orcamento: number | null
        }
        Insert: {
          checklist_bateria?: boolean | null
          checklist_cabos?: boolean | null
          checklist_carregador?: boolean | null
          checklist_controle?: boolean | null
          checklist_equipamento_tipo_id?: string | null
          checklist_helices?: boolean | null
          checklist_outros?: boolean | null
          ciclos_carga_entrada?: number | null
          ciclos_carga_saida?: number | null
          cliente_id: string
          commission_assistants_computed_at?: string | null
          commission_assistants_fixed?: number
          commission_assistants_percentage?: number
          commission_assistants_total?: number
          commission_computed_at?: string | null
          commission_products?: number
          commission_services?: number
          commission_total?: number
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
          nfe_emitida?: boolean | null
          nfse_numero?: string | null
          numero: string
          numero_serie?: string | null
          observacoes?: string | null
          organization_id?: string | null
          prioridade?: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["status_os"]
          tecnico_id?: string | null
          tipo_equipamento: Database["public"]["Enums"]["tipo_equipamento"]
          tipo_os?: Database["public"]["Enums"]["tipo_os"] | null
          updated_at?: string
          valor_final?: number | null
          valor_orcamento?: number | null
        }
        Update: {
          checklist_bateria?: boolean | null
          checklist_cabos?: boolean | null
          checklist_carregador?: boolean | null
          checklist_controle?: boolean | null
          checklist_equipamento_tipo_id?: string | null
          checklist_helices?: boolean | null
          checklist_outros?: boolean | null
          ciclos_carga_entrada?: number | null
          ciclos_carga_saida?: number | null
          cliente_id?: string
          commission_assistants_computed_at?: string | null
          commission_assistants_fixed?: number
          commission_assistants_percentage?: number
          commission_assistants_total?: number
          commission_computed_at?: string | null
          commission_products?: number
          commission_services?: number
          commission_total?: number
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
          nfe_emitida?: boolean | null
          nfse_numero?: string | null
          numero?: string
          numero_serie?: string | null
          observacoes?: string | null
          organization_id?: string | null
          prioridade?: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["status_os"]
          tecnico_id?: string | null
          tipo_equipamento?: Database["public"]["Enums"]["tipo_equipamento"]
          tipo_os?: Database["public"]["Enums"]["tipo_os"] | null
          updated_at?: string
          valor_final?: number | null
          valor_orcamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_checklist_equipamento_tipo_id_fkey"
            columns: ["checklist_equipamento_tipo_id"]
            isOneToOne: false
            referencedRelation: "checklist_tipos_equipamento"
            referencedColumns: ["id"]
          },
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
          expires_at: string | null
          id: string
          is_vip: boolean
          max_os_per_month: number
          max_users: number
          monthly_fee: number
          name: string
          next_due_date: string | null
          owner_id: string
          plan: string
          plan_id: string | null
          settings: Json | null
          slug: string
          status: string
          subscription_status: string
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
          expires_at?: string | null
          id?: string
          is_vip?: boolean
          max_os_per_month?: number
          max_users?: number
          monthly_fee?: number
          name: string
          next_due_date?: string | null
          owner_id: string
          plan?: string
          plan_id?: string | null
          settings?: Json | null
          slug: string
          status?: string
          subscription_status?: string
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
          expires_at?: string | null
          id?: string
          is_vip?: boolean
          max_os_per_month?: number
          max_users?: number
          monthly_fee?: number
          name?: string
          next_due_date?: string | null
          owner_id?: string
          plan?: string
          plan_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          subscription_status?: string
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
      os_apontamentos_horas: {
        Row: {
          created_at: string
          fim: string | null
          horas_lancadas: number | null
          id: string
          inicio: string
          item_os_id: string | null
          observacao: string | null
          origem: string
          os_id: string
          tecnico_id: string | null
        }
        Insert: {
          created_at?: string
          fim?: string | null
          horas_lancadas?: number | null
          id?: string
          inicio?: string
          item_os_id?: string | null
          observacao?: string | null
          origem?: string
          os_id: string
          tecnico_id?: string | null
        }
        Update: {
          created_at?: string
          fim?: string | null
          horas_lancadas?: number | null
          id?: string
          inicio?: string
          item_os_id?: string | null
          observacao?: string | null
          origem?: string
          os_id?: string
          tecnico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_apontamentos_horas_item_os_id_fkey"
            columns: ["item_os_id"]
            isOneToOne: false
            referencedRelation: "itens_os"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_apontamentos_horas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_checklist_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string
          marcado: boolean
          ordem_servico_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          marcado?: boolean
          ordem_servico_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          marcado?: boolean
          ordem_servico_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_checklist_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_equipamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_checklist_itens_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_checklist_itens_organization_id_fkey"
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
      os_technicians: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string | null
          id: string
          net_value_received: number | null
          ordem_servico_id: string
          payer_type: Database["public"]["Enums"]["os_technician_payer"]
          role: Database["public"]["Enums"]["os_technician_role"]
          tax_retained_amount: number | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          commission_type: string
          commission_value?: number
          created_at?: string | null
          id?: string
          net_value_received?: number | null
          ordem_servico_id: string
          payer_type?: Database["public"]["Enums"]["os_technician_payer"]
          role?: Database["public"]["Enums"]["os_technician_role"]
          tax_retained_amount?: number | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          id?: string
          net_value_received?: number | null
          ordem_servico_id?: string
          payer_type?: Database["public"]["Enums"]["os_technician_payer"]
          role?: Database["public"]["Enums"]["os_technician_role"]
          tax_retained_amount?: number | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_technicians_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_technicians_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      os_tecnicos_ajudantes: {
        Row: {
          created_at: string
          id: string
          ordem_servico_id: string
          porcentagem_comissao: number | null
          tecnico_id: string
          tipo_comissao: string
          updated_at: string
          valor_comissao: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          ordem_servico_id: string
          porcentagem_comissao?: number | null
          tecnico_id: string
          tipo_comissao: string
          updated_at?: string
          valor_comissao?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          ordem_servico_id?: string
          porcentagem_comissao?: number | null
          tecnico_id?: string
          tipo_comissao?: string
          updated_at?: string
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_tecnicos_ajudantes_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_tecnicos_ajudantes_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimonio_ferramentas: {
        Row: {
          created_at: string
          id: string
          nome: string
          numero_serie: string | null
          organization_id: string
          status: string
          tecnico_atual_id: string | null
          updated_at: string
          valor_referencia: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          numero_serie?: string | null
          organization_id: string
          status?: string
          tecnico_atual_id?: string | null
          updated_at?: string
          valor_referencia?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          numero_serie?: string | null
          organization_id?: string
          status?: string
          tecnico_atual_id?: string | null
          updated_at?: string
          valor_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patrimonio_ferramentas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimonio_movimentacoes: {
        Row: {
          confirmado_por: string | null
          created_at: string
          id: string
          observacao: string | null
          patrimonio_id: string
          tecnico_anterior_id: string | null
          tecnico_novo_id: string | null
          tipo: string
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          patrimonio_id: string
          tecnico_anterior_id?: string | null
          tecnico_novo_id?: string | null
          tipo: string
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          patrimonio_id?: string
          tecnico_anterior_id?: string | null
          tecnico_novo_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrimonio_movimentacoes_patrimonio_id_fkey"
            columns: ["patrimonio_id"]
            isOneToOne: false
            referencedRelation: "patrimonio_ferramentas"
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
          commission_on_products: boolean
          commission_on_services: boolean
          created_at: string
          email: string
          id: string
          nome: string
          organization_id: string | null
          product_commission_type: string
          product_commission_value: number
          responsabilidades: string
          service_commission_type: string
          service_commission_value: number
          telefone: string | null
          updated_at: string
          valor_hora_tecnica: number | null
        }
        Insert: {
          avatar_url?: string | null
          commission_on_products?: boolean
          commission_on_services?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          organization_id?: string | null
          product_commission_type?: string
          product_commission_value?: number
          responsabilidades?: string
          service_commission_type?: string
          service_commission_value?: number
          telefone?: string | null
          updated_at?: string
          valor_hora_tecnica?: number | null
        }
        Update: {
          avatar_url?: string | null
          commission_on_products?: boolean
          commission_on_services?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          organization_id?: string | null
          product_commission_type?: string
          product_commission_value?: number
          responsabilidades?: string
          service_commission_type?: string
          service_commission_value?: number
          telefone?: string | null
          updated_at?: string
          valor_hora_tecnica?: number | null
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
          fracionamento: string
          hora_minima: number | null
          id: string
          organization_id: string | null
          preco: number
          tempo_estimado: string | null
          tipo_cobranca: string
          updated_at: string
          valor_fixo: number | null
          valor_hora: number | null
        }
        Insert: {
          created_at?: string
          descricao: string
          fracionamento?: string
          hora_minima?: number | null
          id?: string
          organization_id?: string | null
          preco?: number
          tempo_estimado?: string | null
          tipo_cobranca?: string
          updated_at?: string
          valor_fixo?: number | null
          valor_hora?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string
          fracionamento?: string
          hora_minima?: number | null
          id?: string
          organization_id?: string | null
          preco?: number
          tempo_estimado?: string | null
          tipo_cobranca?: string
          updated_at?: string
          valor_fixo?: number | null
          valor_hora?: number | null
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
      site_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          billing_cycle: string
          created_at: string
          features: Json
          id: string
          max_os_per_month: number
          max_users: number
          monthly_price: number
          name: string
          slug: string
          updated_at: string
          yearly_price: number
        }
        Insert: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          features?: Json
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_price?: number
          name: string
          slug: string
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          features?: Json
          id?: string
          max_os_per_month?: number
          max_users?: number
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          organization_id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          organization_id: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tax_retention_ledger: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          os_id: string
          release_date: string | null
          released_at: string | null
          released_by: string | null
          retained_at: string | null
          status: Database["public"]["Enums"]["tax_retention_status"]
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          os_id: string
          release_date?: string | null
          released_at?: string | null
          released_by?: string | null
          retained_at?: string | null
          status?: Database["public"]["Enums"]["tax_retention_status"]
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          os_id?: string
          release_date?: string | null
          released_at?: string | null
          released_by?: string | null
          retained_at?: string | null
          status?: Database["public"]["Enums"]["tax_retention_status"]
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_retention_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_retention_ledger_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_retention_ledger_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_retention_ledger_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          created_by: string | null
          description: string
          expense_date: string
          id: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      transferencias_estoque: {
        Row: {
          confirmado_por: string | null
          confirmed_at: string | null
          created_at: string
          destino_id: string
          destino_tipo: string
          id: string
          item_estoque_id: string
          organization_id: string
          origem_id: string
          origem_tipo: string
          quantidade: number
          solicitado_por: string | null
          status: string
        }
        Insert: {
          confirmado_por?: string | null
          confirmed_at?: string | null
          created_at?: string
          destino_id: string
          destino_tipo: string
          id?: string
          item_estoque_id: string
          organization_id: string
          origem_id: string
          origem_tipo: string
          quantidade: number
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          confirmado_por?: string | null
          confirmed_at?: string | null
          created_at?: string
          destino_id?: string
          destino_tipo?: string
          id?: string
          item_estoque_id?: string
          organization_id?: string
          origem_id?: string
          origem_tipo?: string
          quantidade?: number
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_estoque_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transportadoras: {
        Row: {
          ativo: boolean
          bairro: string
          cep: string
          cidade: string
          complemento: string
          contato: string
          cpf_cnpj: string
          created_at: string
          email: string
          endereco: string
          estado: string
          id: string
          inscricao_estadual: string
          nome: string
          nome_fantasia: string
          numero: string
          observacoes: string
          organization_id: string
          rntrc: string
          telefone: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          contato?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_estadual?: string
          nome: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          organization_id: string
          rntrc?: string
          telefone?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          contato?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_estadual?: string
          nome?: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          organization_id?: string
          rntrc?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "transportadoras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          acesso_checklist: boolean
          acesso_clientes: boolean
          acesso_cobrancas: boolean
          acesso_configuracoes: boolean
          acesso_dashboard: boolean
          acesso_empresa: boolean
          acesso_equipe: boolean
          acesso_estoque: boolean
          acesso_financeiro: boolean
          acesso_meu_painel: boolean
          acesso_notificacoes: boolean
          acesso_oficina_vivo: boolean
          acesso_orcamentos: boolean
          acesso_os: boolean
          acesso_relatorios: boolean
          acesso_rotas: boolean
          acesso_servicos: boolean
          acesso_suporte: boolean
          acesso_wiki: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acesso_checklist?: boolean
          acesso_clientes?: boolean
          acesso_cobrancas?: boolean
          acesso_configuracoes?: boolean
          acesso_dashboard?: boolean
          acesso_empresa?: boolean
          acesso_equipe?: boolean
          acesso_estoque?: boolean
          acesso_financeiro?: boolean
          acesso_meu_painel?: boolean
          acesso_notificacoes?: boolean
          acesso_oficina_vivo?: boolean
          acesso_orcamentos?: boolean
          acesso_os?: boolean
          acesso_relatorios?: boolean
          acesso_rotas?: boolean
          acesso_servicos?: boolean
          acesso_suporte?: boolean
          acesso_wiki?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acesso_checklist?: boolean
          acesso_clientes?: boolean
          acesso_cobrancas?: boolean
          acesso_configuracoes?: boolean
          acesso_dashboard?: boolean
          acesso_empresa?: boolean
          acesso_equipe?: boolean
          acesso_estoque?: boolean
          acesso_financeiro?: boolean
          acesso_meu_painel?: boolean
          acesso_notificacoes?: boolean
          acesso_oficina_vivo?: boolean
          acesso_orcamentos?: boolean
          acesso_os?: boolean
          acesso_relatorios?: boolean
          acesso_rotas?: boolean
          acesso_servicos?: boolean
          acesso_suporte?: boolean
          acesso_wiki?: boolean
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
      venda_itens: {
        Row: {
          cfop: string | null
          created_at: string
          desconto_percentual: number
          desconto_valor: number
          icms_percentual: number | null
          icms_valor: number | null
          id: string
          ipi_valor: number | null
          ncm: string | null
          nome_produto: string
          pis_cofins_valor: number | null
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          valor_total: number
          venda_id: string
        }
        Insert: {
          cfop?: string | null
          created_at?: string
          desconto_percentual?: number
          desconto_valor?: number
          icms_percentual?: number | null
          icms_valor?: number | null
          id?: string
          ipi_valor?: number | null
          ncm?: string | null
          nome_produto: string
          pis_cofins_valor?: number | null
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          venda_id: string
        }
        Update: {
          cfop?: string | null
          created_at?: string
          desconto_percentual?: number
          desconto_valor?: number
          icms_percentual?: number | null
          icms_valor?: number | null
          id?: string
          ipi_valor?: number | null
          ncm?: string | null
          nome_produto?: string
          pis_cofins_valor?: number | null
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          atualizado_em: string
          cliente_cpf_cnpj: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string
          criado_em: string
          data_venda: string
          forma_pagamento: string | null
          id: string
          nf_chave: string | null
          nf_emitida_em: string | null
          nf_numero: string | null
          nf_provider: string | null
          nfe_dados: Json
          numero: string
          obs: string | null
          organization_id: string
          status_pagamento: string
          valor_desconto: number
          valor_impostos: number
          valor_produtos: number
          valor_total: number
          vendido_por: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          criado_em?: string
          data_venda?: string
          forma_pagamento?: string | null
          id?: string
          nf_chave?: string | null
          nf_emitida_em?: string | null
          nf_numero?: string | null
          nf_provider?: string | null
          nfe_dados?: Json
          numero: string
          obs?: string | null
          organization_id: string
          status_pagamento?: string
          valor_desconto?: number
          valor_impostos?: number
          valor_produtos?: number
          valor_total?: number
          vendido_por?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          criado_em?: string
          data_venda?: string
          forma_pagamento?: string | null
          id?: string
          nf_chave?: string | null
          nf_emitida_em?: string | null
          nf_numero?: string | null
          nf_provider?: string | null
          nfe_dados?: Json
          numero?: string
          obs?: string | null
          organization_id?: string
          status_pagamento?: string
          valor_desconto?: number
          valor_impostos?: number
          valor_produtos?: number
          valor_total?: number
          vendido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_articles: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          media: Json
          published: boolean
          slug: string
          sort_order: number
          summary: string | null
          tags: string[]
          title: string
          tour_steps: Json
          tour_target_route: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media?: Json
          published?: boolean
          slug: string
          sort_order?: number
          summary?: string | null
          tags?: string[]
          title: string
          tour_steps?: Json
          tour_target_route?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media?: Json
          published?: boolean
          slug?: string
          sort_order?: number
          summary?: string | null
          tags?: string[]
          title?: string
          tour_steps?: Json
          tour_target_route?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wiki_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      wiki_tour_progress: {
        Row: {
          article_id: string
          completed_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          completed_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          completed_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_tour_progress_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      batch_release_technician_retentions: {
        Args: { _technician_id: string }
        Returns: Json
      }
      calculate_os_commission: { Args: { _os_id: string }; Returns: number }
      calculate_os_technician_commission: {
        Args: { _os_id: string }
        Returns: Json
      }
      count_active_users: { Args: { _org: string }; Returns: number }
      count_os_current_month: { Args: { _org: string }; Returns: number }
      get_dre_simplificada: {
        Args: { _org: string; _periodo: string }
        Returns: Json
      }
      get_fluxo_caixa_projetado: {
        Args: { _dias?: number; _org: string }
        Returns: Json
      }
      get_technician_dashboard: { Args: { _tecnico_id: string }; Returns: Json }
      get_technician_financial_dashboard: {
        Args: {
          _period_end?: string
          _period_start?: string
          _tecnico_id?: string
        }
        Returns: Json
      }
      get_technician_os_statement: {
        Args: {
          _period_end: string
          _period_start: string
          _tecnico_id: string
        }
        Returns: Json
      }
      get_technician_retention_details: {
        Args: { _technician_id: string }
        Returns: Json
      }
      get_technician_retention_summary: { Args: never; Returns: Json }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_workshop_board: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_tecnico: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      notify_broadcast_global: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      notify_broadcast_org: {
        Args: {
          _body: string
          _link: string
          _org_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_org_all: {
        Args: {
          _body: string
          _link: string
          _org_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_org_role: {
        Args: {
          _body: string
          _link: string
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _org_id: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      reservar_numero_nfe: {
        Args: { _org: string }
        Returns: {
          numero: number
          serie: number
        }[]
      }
      set_user_roles: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "consulta"
      fiscal_doc_status:
        | "DRAFT"
        | "PROCESSING"
        | "AUTHORIZED"
        | "REJECTED"
        | "CANCELLED"
      fiscal_doc_type: "NFSE" | "NFE" | "NFCE"
      os_technician_payer: "COMPANY" | "PRINCIPAL" | "SHARED"
      os_technician_role: "PRINCIPAL" | "AUXILIARY"
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
        | "finalizada"
      tax_retention_status: "RETAINED" | "RELEASED_TO_TECH" | "PAID_TO_GOV"
      tipo_equipamento:
        | "drone_agricola"
        | "drone_convencional"
        | "controle"
        | "bateria"
        | "outro"
      tipo_os: "normal" | "revisao"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      fiscal_doc_status: [
        "DRAFT",
        "PROCESSING",
        "AUTHORIZED",
        "REJECTED",
        "CANCELLED",
      ],
      fiscal_doc_type: ["NFSE", "NFE", "NFCE"],
      os_technician_payer: ["COMPANY", "PRINCIPAL", "SHARED"],
      os_technician_role: ["PRINCIPAL", "AUXILIARY"],
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
        "finalizada",
      ],
      tax_retention_status: ["RETAINED", "RELEASED_TO_TECH", "PAID_TO_GOV"],
      tipo_equipamento: [
        "drone_agricola",
        "drone_convencional",
        "controle",
        "bateria",
        "outro",
      ],
      tipo_os: ["normal", "revisao"],
      tipo_transacao: ["receita", "despesa", "salario", "comissao"],
    },
  },
} as const
