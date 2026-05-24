import { expect, test } from '@playwright/test'

test('login page renders the sign-in heading', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()
})

test('login page keeps the identifier and password inputs visible', async ({ page }) => {
  await page.goto('/login')

  const identifier = page.locator('#identifier')
  const password = page.locator('#password')

  await identifier.fill('alice')
  await password.fill('correct horse battery staple')

  await expect(identifier).toHaveValue('alice')
  await expect(password).toHaveValue('correct horse battery staple')
})

test('login page toggles password visibility', async ({ page }) => {
  await page.goto('/login')

  const password = page.locator('#password')

  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
})

test('login page renders the submit control', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
})

test('signup page renders the account creation heading', async ({ page }) => {
  await page.goto('/signup')

  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
})

test('signup page renders password guidance', async ({ page }) => {
  await page.goto('/signup')

  await expect(page.getByText('At least 8 characters')).toBeVisible()
})

test('signup page renders the submit action', async ({ page }) => {
  await page.goto('/signup')

  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
})