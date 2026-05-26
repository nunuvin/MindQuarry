import { expect, test } from '@playwright/test'

test('search page renders its empty prompt', async ({ page }) => {
  await page.goto('/search')

  await expect(page.getByRole('heading', { name: 'Find quarries, queries, and people' })).toBeVisible()
  await expect(page.getByText('Enter a term to search the platform.')).toBeVisible()
})

test('search page renders a no-results state for an unlikely query', async ({ page }) => {
  await page.goto('/search?q=zzzzunlikelymindquarryquery')

  await expect(page.getByText('No results found for')).toBeVisible()
})