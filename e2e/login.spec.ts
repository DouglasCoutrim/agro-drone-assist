import { test, expect } from "@playwright/test";

/**
 * Playwright tests for the LivreOS login screen.
 * Verifies the visual structure and basic functionality of the login page.
 */
test.describe("Login screen", () => {
  test.beforeEach(async ({ page }) => {
    // The root path serves the Auth component; /auth is the explicit route.
    await page.goto("/auth");
    await expect(page.getByTestId("login-screen")).toBeVisible();
  });

  test("renders the brand logo", async ({ page }) => {
    const brand = page.getByTestId("login-screen").locator(".livreos-login__brand");
    await expect(brand).toBeVisible();
  });

  test("displays the headline and description", async ({ page }) => {
    const headline = page.getByTestId("login-screen").locator(".livreos-login__headline");
    const description = page.getByTestId("login-screen").locator(".livreos-login__description");
    await expect(headline).toBeVisible();
    await expect(description).toBeVisible();
    await expect(headline).toContainText("ERP Completo para");
    await expect(headline).toContainText("Assistência Técnica");
    await expect(description).toContainText(
      "Gestão, atendimento, serviços, estoque e financeiro em um só lugar.",
    );
  });

  test("renders the login form with email and password fields", async ({ page }) => {
    const form = page.getByTestId("login-form");
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/Email/)).toBeVisible();
    await expect(form.getByLabel(/Senha/)).toBeVisible();
    await expect(form.getByRole("button", { name: /Entrar/ })).toBeVisible();
  });

  test("has the five segment cards", async ({ page }) => {
    const segments = page.getByTestId("login-segments");
    await expect(segments).toBeVisible();
    const segmentItems = segments.locator(".livreos-login__segment");
    await expect(segmentItems).toHaveCount(5);
    await expect(segmentItems.nth(0)).toContainText("Assistência Técnica");
    await expect(segmentItems.nth(1)).toContainText("Drones Agrícolas");
    await expect(segmentItems.nth(2)).toContainText("Mobilidade Elétrica");
    await expect(segmentItems.nth(3)).toContainText("Carros Elétricos");
    await expect(segmentItems.nth(4)).toContainText("Máquinas Agrícolas");
  });

  test("has the 'Esqueci minha senha' link", async ({ page }) => {
    const link = page.getByRole("link", { name: /Esqueci minha senha/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/reset-password");
  });

  test("has the 'Criar conta grátis' link", async ({ page }) => {
    const link = page.getByRole("link", { name: /Criar conta grátis/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/cadastro-empresa");
  });

  test("has the 'Lembrar-me' checkbox", async ({ page }) => {
    const checkbox = page.getByLabel(/Lembrar-me/);
    await expect(checkbox).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    const password = page.getByLabel(/Senha/);
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /Mostrar senha/ }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});
