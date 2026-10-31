import { describe, it, expect } from "vitest";
import { toggleHrefs } from "./permissionTree";
import { canAccessHref, sectionsForRoles } from "@/components/layout/navConfig";

describe("permissões em árvore", () => {
  it("módulo marcado com um subitem desmarcado bloqueia só esse subitem", () => {
    const estoque = ["/estoque", "/estoque/importar-xml", "/compras", "/demonstracoes"];
    let blocked = toggleHrefs([], estoque, true);
    blocked = toggleHrefs(blocked, ["/compras"], false);
    expect(blocked).toEqual(["/compras"]);
    const items = sectionsForRoles(["tecnico"], blocked).find((s) => s.title === "Estoque")!.items.map((i) => i.href);
    expect(items).toContain("/estoque");
    expect(items).not.toContain("/compras");
  });
  it("desmarcar o módulo bloqueia todos os itens e esconde o módulo", () => {
    const blocked = toggleHrefs([], ["/estoque", "/estoque/importar-xml", "/compras", "/demonstracoes"], false);
    expect(sectionsForRoles(["tecnico"], blocked).some((s) => s.title === "Estoque")).toBe(false);
  });
  it("administrador sempre tem acesso", () => {
    expect(canAccessHref("/compras", ["admin"], ["/compras"])).toBe(true);
  });
});
