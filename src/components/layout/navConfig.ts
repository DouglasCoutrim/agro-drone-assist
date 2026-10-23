import {
  LayoutDashboard, FileText, BarChart3, DollarSign, Settings, Users, CreditCard, UsersRound,
  Building2, ClipboardList, LifeBuoy, BookOpen, Bell, Wrench, Monitor, Calculator, ShoppingCart, Package, Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem { title: string; icon: LucideIcon; href: string; roles: string[] }
export interface NavSection { title: string; items: NavItem[] }

const ALL = ["admin", "tecnico", "consulta"];
const STAFF = ["admin", "tecnico"];
const ADMIN = ["admin"];

/** Menu único usado no computador e no celular. */
export const navSections: NavSection[] = [
  {
    title: "Início",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ALL },
      { title: "Meu Painel (Técnico)", icon: Wrench, href: "/technician/dashboard", roles: STAFF },
      { title: "Meu Financeiro", icon: Calculator, href: "/technician/financeiro", roles: ["tecnico"] },
      { title: "Oficina ao Vivo (TV)", icon: Monitor, href: "/workshop/live", roles: ALL },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { title: "Clientes", icon: Users, href: "/clientes", roles: ALL },
      { title: "Fornecedores", icon: Building2, href: "/fornecedores", roles: ALL },
      { title: "Transportadoras", icon: Truck, href: "/transportadoras", roles: ALL },
      { title: "Serviços", icon: Wrench, href: "/servicos", roles: ALL },
    ],
  },
  {
    title: "Estoque",
    items: [{ title: "Produtos e Peças", icon: Package, href: "/estoque", roles: ALL }],
  },
  {
    title: "Atendimento",
    items: [
      { title: "Ordens de Serviço", icon: FileText, href: "/ordens-servico", roles: ALL },
      { title: "Orçamentos", icon: ClipboardList, href: "/orcamentos", roles: STAFF },

    ],
  },
  {
    title: "Vendas",
    items: [{ title: "Vendas e Notas Fiscais", icon: ShoppingCart, href: "/vendas", roles: STAFF }],
  },
  {
    title: "Financeiro",
    items: [
      { title: "Financeiro", icon: DollarSign, href: "/financeiro", roles: STAFF },
      { title: "Cobranças", icon: CreditCard, href: "/cobrancas", roles: STAFF },
      { title: "Relatórios", icon: BarChart3, href: "/relatorios", roles: ALL },
    ],
  },
  {
    title: "Configurações",
    items: [
      { title: "Equipe", icon: UsersRound, href: "/equipe", roles: ADMIN },
      { title: "Empresa", icon: Building2, href: "/empresa", roles: ADMIN },
      { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ADMIN },
      { title: "Checklist de OS", icon: ClipboardList, href: "/admin/configuracao-os", roles: ADMIN },
    ],
  },
  {
    title: "Ajuda",
    items: [
      { title: "Notificações", icon: Bell, href: "/notificacoes", roles: ALL },
      { title: "Central de Ajuda", icon: BookOpen, href: "/wiki", roles: ALL },
      { title: "Suporte", icon: LifeBuoy, href: "/suporte", roles: ALL },
    ],
  },
];

export function sectionsForRoles(roles: string[]): NavSection[] {
  return navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => roles.some((r) => i.roles.includes(r))) }))
    .filter((s) => s.items.length > 0);
}
