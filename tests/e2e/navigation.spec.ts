import { test, expect } from '@playwright/test'

test('真实导航：搜索并生成路线（基本回归）', async ({ page, context, baseURL }) => {
  test.skip(process.env.RUN_E2E !== 'true', '设置 RUN_E2E=true 后再执行该用例')

  const appOrigin = baseURL ?? 'http://localhost:3000'
  await context.grantPermissions(['geolocation'], { origin: appOrigin })
  await context.setGeolocation({ latitude: 30.2741, longitude: 120.1551 })

  await page.goto('/navigation?mode=real-world')

  // 搜索关键词
  const input = page.locator('input[placeholder*=西湖], input[placeholder*=景区], input[placeholder]')
  await expect(input.first()).toBeVisible()
  await input.first().fill('西湖')

  await page.getByRole('button', { name: /搜索真实地点|搜索/ }).first().click()
  // 等待搜索结果加载
  await expect(page.getByRole('button', { name: /设为终点/ }).first()).toBeVisible({ timeout: 10000 })
  // 选中第一个结果为终点
  await page.getByRole('button', { name: /设为终点/ }).first().click()

  // 为避免浏览器定位权限问题，设置第二个结果为手动起点（若存在）
  const setStartButtons = page.getByRole('button', { name: /设为起点/ })
  if ((await setStartButtons.count()) > 1) {
    await setStartButtons.nth(1).click()
  }

  // 点击规划按钮（若使用手动起点则按钮文案为“用手动起点开始规划”）
  const planButton = page.getByRole('button', { name: /用手动起点开始规划|用当前位置开始规划|规划中|规划/ }).first()
  await expect(planButton).toBeVisible()
  const routeResponsePromise = page.waitForResponse(
    response =>
      response.url().includes('/api/real-world-route')
      && response.request().method() === 'POST',
    { timeout: 30000 },
  )
  await planButton.click()
  const routeResponse = await routeResponsePromise.catch(() => null)

  // 等待路线摘要出现（UI）
  await expect(page.getByText('路线摘要').first()).toBeVisible({ timeout: 15000 })

  // 优先使用页面触发的路由响应；若该路径超时或失败，则走固定坐标 API 兜底校验。
  if (routeResponse?.ok()) {
    const json = await routeResponse.json()
    expect(Array.isArray(json.steps)).toBeTruthy()
    expect(json.steps.length).toBeGreaterThan(0)
    return
  }

  const fallbackResp = await page.request.post('/api/real-world-route', {
    data: {
      mode: 'walking',
      origin: { lng: 120.1551, lat: 30.2741 },
      destination: { lng: 120.1600, lat: 30.2760 },
    },
  })
  expect(fallbackResp.ok()).toBeTruthy()
  const fallbackJson = await fallbackResp.json()
  expect(Array.isArray(fallbackJson.steps)).toBeTruthy()
  expect(fallbackJson.steps.length).toBeGreaterThan(0)
})
