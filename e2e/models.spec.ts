import { test, expect } from '@playwright/test'

test('home renders rankings preview and links to models', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('AI RADAR')).toBeVisible()
  await expect(page.getByText('模型排行')).toBeVisible()

  // Desktop nav should expose the link.
  await page.getByRole('link', { name: 'Models' }).click()
  await expect(page).toHaveURL(/\\/models$/)
})

test('/models renders domain cards and has empty-state copy when no data', async ({ page }) => {
  await page.goto('/models')

  await expect(page.getByRole('heading', { name: '模型排行' })).toBeVisible()
  await expect(page.getByText('编程')).toBeVisible()
  await expect(page.getByText('数学')).toBeVisible()
  await expect(page.getByText('文本')).toBeVisible()
  await expect(page.getByText('图片')).toBeVisible()
  await expect(page.getByText('视频')).toBeVisible()
  await expect(page.getByText('语音')).toBeVisible()

  // When DB is not reachable in CI, we should still render a deterministic empty state.
  await expect(page.getByText('暂无数据')).toBeVisible()
})

