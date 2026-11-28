import { permissionItems } from "./navConfig";

/** Abre a busca global (mesmo atalho Ctrl+K usado pelo GlobalSearch). */
export function openGlobalSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
}

/** Título da página atual a partir do menu compartilhado (inclui as telas fora do menu). */
export function pageTitleFor(pathname: string): string {
  const item = permissionItems.find((i) => i.href === pathname);
  return item ? item.title : "LivreOS";
}
