import { test, expect } from "@playwright/test";

/**
 * A tela de Comissões (`/comissoes`) é restrita ao papel `admin`. Sem sessão, a rota manda
 * para o login e o conteúdo administrativo (faturas de saque e conferência) não é renderizado.
 */
test.describe("Comissões (admin)", () => {
  test("exige autenticação antes de mostrar as faturas de saque", async ({ page }) => {
    await page.goto("/comissoes");

    // Redirecionado para o login.
    await expect(page.getByTestId("login-screen")).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);

    // O conteúdo administrativo não é renderizado.
    await expect(page.getByRole("heading", { name: "Comissões" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Faturas de saque/ })).toHaveCount(0);
  });
});
