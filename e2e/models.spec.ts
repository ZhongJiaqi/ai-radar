import { test, expect } from '@playwright/test'

test('home renders and links to models', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'AI Radar' })).toBeVisible()

  // Desktop nav should expose the link.
  await page.getByRole('link', { name: 'Models' }).click()
  await expect(page).toHaveURL(/\/models$/)
})

test('/models renders domain cards with rankings', async ({ page }) => {
  await page.goto('/models')

  await expect(page.getByRole('heading', { name: '模型排行' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '编程' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '文本' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '图片' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '视频' })).toBeVisible()
})
