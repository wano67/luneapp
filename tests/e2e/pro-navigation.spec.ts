import { test, expect } from '@playwright/test';

const businessId = process.env.PRO_E2E_BUSINESS_ID;
const projectId = process.env.PRO_E2E_PROJECT_ID;
const serviceId = process.env.PRO_E2E_SERVICE_ID;
const productId = process.env.PRO_E2E_PRODUCT_ID;

test.describe('Navigation PRO', () => {
  test.skip(!businessId, 'PRO_E2E_BUSINESS_ID requis pour les tests de navigation PRO');

  test('Projets -> détail et tabs', async ({ page }) => {
    test.skip(!projectId, 'PRO_E2E_PROJECT_ID requis pour ouvrir un projet');
    await page.goto(`/app/pro/${businessId}/projects`);
    await expect(page.getByRole('heading', { name: /Projets/i })).toBeVisible();
    await page.goto(`/app/pro/${businessId}/projects/${projectId}`);
    await expect(page.getByRole('heading', { name: /Projet/i })).toBeVisible();
    await page.getByRole('tab', { name: /Travail/i }).click();
    await page.getByRole('tab', { name: /Équipe/i }).click();
    await page.getByRole('tab', { name: /Facturation/i }).click();
    await page.getByRole('tab', { name: /Documents/i }).click();
  });

  test('Checklist projet ouvre un modal', async ({ page }) => {
    test.skip(!projectId, 'PRO_E2E_PROJECT_ID requis pour ouvrir un projet');
    await page.goto(`/app/pro/${businessId}/projects/${projectId}`);
    const button = page.getByRole('button', { name: /Associer un client|Définir la date|Ajouter des services|Configurer les tâches|Ajouter un membre|Ajouter un document/i }).first();
    if (await button.count()) {
      await button.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    } else {
      test.skip(true, 'Aucune action de checklist disponible');
    }
  });

  test('Catalogue navigation', async ({ page }) => {
    await page.goto(`/app/pro/${businessId}/catalog`);
    await expect(page.getByRole('heading', { name: /Catalogue/i })).toBeVisible();
    await page.getByTestId('catalog-new').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Catalogue détail service/produit', async ({ page }) => {
    test.skip(!serviceId && !productId, 'PRO_E2E_SERVICE_ID ou PRO_E2E_PRODUCT_ID requis');
    if (serviceId) {
      await page.goto(`/app/pro/${businessId}/catalog/services/${serviceId}`);
      await expect(page.getByRole('heading')).toContainText(/Service|Projet/i);
    }
    if (productId) {
      await page.goto(`/app/pro/${businessId}/catalog/products/${productId}`);
      await expect(page.getByRole('heading')).toContainText(/Produit|SKU/i);
    }
  });
});
