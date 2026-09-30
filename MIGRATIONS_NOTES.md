# MIGRATIONS_NOTES

## Ordem de aplicação em produção

Esta documentação lista a ordem em que as migrations devem ser aplicadas em produção, considerando as dependências entre elas.

### Pré-requisitos (já aplicados em produção)
1. `20251207200702_fab9fc53-69ca-43ba-a4fc-9c244125cbfa.sql` - Schema base (perfis, roles, clientes, estoque, etc.)
2. `20260304022907_09cc2793-bfe9-42d8-8401-0cb12bbf74b3.sql` - Schema adicional
3. `20260305123058_24b234d3-26be-4892-a4c3-f6bb105aa395.sql` - Triggers e permissões
4. `20260305130706_5f141bae-1f35-4b85-bc19-17cdb1adffee.sql` - Empresa config inicial
5. `20260305132841_214e7266-0054-4ffb-a4db-39747b060f3e.sql` - Schema adicional
6. `20260307022216_2b3903ae-e6d8-49f2-8bb8-11c8e5af070e.sql` - Schema adicional
7. `20260307024917_7cc9a750-1c9f-4b91-b642-dcb46730a2b4.sql` - Schema adicional
8. `20260307030630_e6502ee4-7ba5-4074-a79c-26438fbf00b2.sql` - Schema adicional
9. `20260311002423_31639d43-27f3-42f0-a13f-8274ffdaf37b.sql` - Schema adicional
10. `20260317010758_a77a953f-623e-4385-869e-4b593878310a.sql` - Schema adicional

### Fase 1 - Segurança Crítica
11. `20260401000000_base_reproducao.sql` - **CRÍTICO**: Tabela `organizations`, função `get_user_org_id()`, colunas `organization_id` em todas as tabelas de negócio. **Deve ser aplicada ANTES de qualquer policy que use `get_user_org_id()`**.
12. `20260413025634_93676e9d-a103-469d-a268-5b566f6f2696.sql` - Schema adicional
13. `20260413030443_536f5e49-ccd5-4c7c-ac27-1ebc788b6c12.sql` - Schema adicional
14. `20260413082636_69a6dfdc-22c0-4e80-b08d-ef0650d33706.sql` - Schema adicional
15. `20260414183259_9a19e864-b54f-4420-bad8-b96cc0538df6.sql` - Primeira policy que usa `get_user_org_id()`
16. `20260415042610_24516b69-0d02-4250-a206-ccc0cc281840.sql` - Schema adicional
17. `20260513124452_e4bfb6f3-647a-4050-9428-d07a172f4105.sql` - Schema adicional
18. `20260516203159_86c7a525-f6fd-4e33-894c-447df210055b.sql` - Tabela `platform_admins`
19. `20260516203757_b4496417-4a06-443c-ab60-d9136106b582.sql` - Schema adicional
20. `20260516205740_b14373ea-99de-46a7-a45e-ea4c08562479.sql` - Planos + colunas gateway + RPCs count_*
21. `20260516210413_f5eb3ecf-3811-419c-b147-1e00b36ab7c8.sql` - Schema adicional
22. `20260517121327_8700dd5e-75d0-49da-87c8-9580877372a6.sql` - Schema adicional
23. `20260517131316_fab14b1d-daac-4cfb-b869-941c96cfbd1c.sql` - Triggers de notificação
24. `20260521014302_cf2ee0a0-982b-4c56-ad34-6e6fc6d49651.sql` - Schema adicional
25. `20260521165407_accb3111-28da-4cd8-adb0-1291c669a8b6.sql` - Schema adicional
26. `20260521170618_0d5ab3e4-399b-4371-9e62-ca7fa096271a.sql` - Schema adicional
27. `20260521170903_24b34fac-10ee-4bad-96b2-30cd4a6a64d2.sql` - Seed platform_admins
28. `20260521171900_a8403339-30e4-446b-87bd-0999b13dea8d.sql` - Schema adicional
29. `20260521174028_7d5b622c-2d7f-4b9d-91eb-b109bdee0ad8.sql` - Schema adicional
30. `20260617115620_8a99b786-a45c-4fc9-8bfc-bef7ad40cbfa.sql` - Schema adicional
31. `20260617132344_c4bb9da4-0da5-4ee6-810a-e04b2af3c942.sql` - Schema adicional
32. `20260617154454_e93d6909-3158-4c6e-91f6-88729f847cb8.sql` - Grants de permissão
33. `20260617154528_4c0e0ad1-ed0f-48c4-b593-4ef426c00032.sql` - Schema adicional
34. `20260617160522_d96fb2f0-232e-4d28-94e5-641f8655a9f5.sql` - Schema adicional
35. `20260617162416_c8e29525-b810-4f10-bb5c-f4e201f1623a.sql` - Triggers
36. `20260618121443_27855d37-4007-40b8-83b3-e0371e4c2e46.sql` - Schema adicional
37. `20260618123536_89e63043-be06-422e-9113-7b6be6077944.sql` - **DESTRUCTIVA**: TRUNCATE de 23 tabelas + DELETE FROM auth.users (apenas com opt-in em platform_config)
38. `20260731103406_ab54d7d0-357e-45a3-bd1d-6b6a8210bd24.sql` - Schema adicional
39. `20260731120000_rls_org_scope.sql` - **CRÍTICO**: RLS org-scope para todas as tabelas + RPCs count_* REVOKE
40. `20260731130000_fix_generate_os_number.sql` - Correção de geração de número OS
41. `20260731140000_fix_user_permissions_trigger.sql` - Trigger de permissões
42. `20260803120000_fix_sara_org_id.sql` - Correção de org_id
43. `20260803130000_segmentos_org_rls_policy.sql` - Policies segmentadas
44. `20260803140000_tecnico_comissao_profile.sql` - Perfil de comissão
45. `20260803150000_comissao_os_dashboards.sql` - RPCs de comissão e dashboards
46. `20260915000000_fix_orphan_profiles.sql` - Perfis órfãos

### Novas migrations (aplicadas por este projeto)
47. `20260919000001_empresa_gateway_credenciais.sql` - Tabela `empresa_gateway_credenciais` e `admin_audit_log` com RLS org-scope
48. `20260919225528_migrate_gateway_credentials.sql` - Migração de dados de `empresa_config` para `empresa_gateway_credenciais`
49. `20260919225529_audit_log_trigger.sql` - Trigger de log de auditoria para bloqueio de tenants
50. `20260919225550_consolidate_loose_scripts.sql` - Consolidação de scripts SQL soltos

### Notas importantes
- A migration `20260618123536_89e63043-be06-422e-9113-7b6be6077944.sql` contém TRUNCATE/DELETE. Só executar com `platform_config.allow_full_reset = {"enabled": true}`.
- A migration `20260401000000_base_reproducao.sql` é pré-requisito para todas as policies que usam `get_user_org_id()`.
- A migration `20260731120000_rls_org_scope.sql` aplica as policies RLS org-scope e revoga EXECUTE das RPCs count_*.
- As novas migrations (47-50) são adicionais e não substituem as existentes.
