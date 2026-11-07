import React from "react";
import { describe, it, expect, mock } from "bun:test";
import { renderToString } from "react-dom/server";

let path = "/vendas";
let blocked = [];
mock.module("react-router-dom", () => ({ useLocation: () => ({ pathname: path, search: "" }), Navigate: () => null }));
mock.module("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "technician" }, role: "tecnico", roles: ["tecnico"], loading: false }) }));
mock.module("@/hooks/useOrganization", () => ({ useOrganization: () => ({ organization: { status: "active" }, isPlatformAdmin: false, loading: false }) }));
mock.module("@/hooks/usePermissions", () => ({ usePermissions: () => ({ permissions: { acesso_financeiro: false }, blocked, loading: false }) }));
mock.module("@/components/layout/MainLayout", () => ({ MainLayout: () => null }));
mock.module("sonner", () => ({ toast: { error: () => {} } }));
const { default: ProtectedRoute } = await import("@/components/ProtectedRoute");

describe("acesso sem depender de permissões antigas", () => {
  for (const href of ["/vendas", "/financeiro", "/cobrancas"]) {
    it(`abre ${href} marcado mesmo com acesso_financeiro=false`, () => {
      path = href; blocked = [];
      let entered = false;
      const Screen = () => { entered = true; return null; };
      renderToString(<ProtectedRoute requiredPermission="acesso_financeiro"><Screen /></ProtectedRoute>);
      expect(entered).toBe(true);
    });
    it(`não abre ${href} desmarcado`, () => {
      path = href; blocked = [href];
      let entered = false;
      const Screen = () => { entered = true; return null; };
      renderToString(<ProtectedRoute requiredPermission="acesso_financeiro"><Screen /></ProtectedRoute>);
      expect(entered).toBe(false);
    });
  }
});