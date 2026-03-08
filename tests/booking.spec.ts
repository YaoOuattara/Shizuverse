// tests/booking.spec.ts
import { test, expect } from '@playwright/test';

test('Booking flow works in English', async ({ page }) => {
  await page.goto('http://localhost:3000/en/service/cleaning');

  // Click Book button or navigate manually
  await page.getByRole('link', { name: 'Book Now' }).click();

  // Fill booking form
  await page.getByLabel('Name').fill('Test User');
  await page.getByLabel('Phone Number').fill('1234567890');
  await page.getByLabel('Location').fill('Test Location');
  await page.getByLabel('Preferred Date').fill('2025-08-25');
  await page.getByLabel('Notes (Optional)').fill('No special notes');

  // Submit form
  await page.getByRole('button', { name: 'Book Now' }).click();

  // Assert confirmation
  await expect(page).toHaveURL(/.*\/booking\/success/);
  await expect(page.locator('text=Booking confirmed')).toBeVisible();
});

