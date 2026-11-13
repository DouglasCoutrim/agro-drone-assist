import {
  LayoutDashboard, FileText, BarChart3, DollarSign, Settings, Users, CreditCard, UsersRound,
  Building2, ClipboardList, LifeBuoy, BookOpen, Bell, Wrench, Monitor, Calculator, ShoppingCart, Package, Truck,
  History,
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
    items: [
      { title: "Produtos e Peças", icon: Package, href: "/estoque", roles: ALL },
      { title: "Importar XML (NF-e)", icon: FileText, href: "/estoque/importar-xml", roles: STAFF },
      { title: "Pedidos de Compra", icon: ShoppingCart, href: "/compras", roles: STAFF },
      { title: "Itens para Demonstração", icon: Package, href: "/demonstracoes", roles: STAFF },
    ],
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
    items: [
      { title: "Nova Venda (PDV)", icon: Calculator, href: "/pdv", roles: STAFF },
      { title: "Pedidos de Venda", icon: ShoppingCart, href: "/vendas", roles: STAFF },
    ],
  },
  {
    title: "Fiscal",
    items: [
      { title: "Notas Fiscais", icon: FileText, href: "/fiscal/notas", roles: STAFF },
      { title: "NF-e de venda", icon: FileText, href: "/fiscal/nfe/venda", roles: STAFF },
      { title: "Devolução de venda", icon: FileText, href: "/fiscal/nfe/devolucao-venda", roles: ADMIN },
      { title: "Devolução de compra", icon: FileText, href: "/fiscal/nfe/devolucao-compra", roles: ADMIN },
      { title: "Nova NFS-e (serviço)", icon: FileText, href: "/fiscal/nfse", roles: STAFF },
      { title: "Configuração fiscal", icon: Settings, href: "/empresa", roles: ADMIN },
    ],
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
      { title: "Ferramentas e Equipamentos", icon: Wrench, href: "/patrimonio", roles: ADMIN },
      { title: "Meu Estoque", icon: Package, href: "/meu-estoque", roles: ALL },
      { title: "Empresa", icon: Building2, href: "/empresa", roles: ADMIN },
      { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ADMIN },
      { title: "Checklist de OS", icon: ClipboardList, href: "/admin/configuracao-os", roles: ADMIN },
      { title: "Auditoria", icon: History, href: "/auditoria", roles: ADMIN },
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

/** Admins always pass; other users are blocked only for hrefs listed in `blocked`. */
export function canAccessHref(href: string, roles: string[], blocked: string[]): boolean {
  if (roles.includes("admin")) return true;
  return !blocked.includes(href);
}

/** Finds the menu href matching the current URL (exact path+query first, then path). */
export function matchNavHref(pathname: string, search = ""): string | null {
  const all = navSections.flatMap((s) => s.items.map((i) => i.href));
  const full = pathname + search;
  return all.find((h) => h === full) ?? all.find((h) => h === pathname) ?? null;
}

export function sectionsForRoles(roles: string[], blocked: string[] = []): NavSection[] {
  return navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => roles.some((r) => i.roles.includes(r)) && canAccessHref(i.href, roles, blocked)) }))
    .filter((s) => s.items.length > 0);
}
