import { navSections } from "./navConfig";

/** Abre a busca global (mesmo atalho Ctrl+K usado pelo GlobalSearch). */
export function openGlobalSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
}

/** Título da página atual a partir do menu compartilhado. */
export function pageTitleFor(pathname: string): string {
  for (const s of navSections) {
    const item = s.items.find((i) => i.href === pathname);
    if (item) return item.title;
  }
  return "LivreOS";
}
