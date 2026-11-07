import { describe, it, expect } from "vitest";
import { functionErrorMessage } from "./function-error";

describe("erro de notas recebidas", () => {
  for (const [status, message] of [
    [400, "Token da Focus NFe não configurado."],
    [403, "Apenas administradores podem buscar notas recebidas."],
    [401, "Não autenticado"],
  ] as const) {
    it(`preserva a orientação do servidor com HTTP ${status}`, async () => {
      const context = new Response(JSON.stringify({ error: message }), { status });
      expect(await functionErrorMessage({ context }, "Genérico")).toBe(message);
      expect(context.bodyUsed).toBe(false);
    });
  }
  it("mantém fallback quando a resposta não contém JSON", async () => {
    expect(await functionErrorMessage({ context: new Response("offline", { status: 503 }) }, "Sem conexão")).toBe("Sem conexão");
  });
});