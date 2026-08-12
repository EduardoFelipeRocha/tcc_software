import { expect, test } from '@playwright/test'

test('busca um concurso e gera um plano semanal', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Seu próximo cargo/ })).toBeVisible()
  await page.getByLabel('Qual concurso você quer conquistar?').fill('Bombeiros RJ')
  await page.getByRole('button', { name: /Encontrar meu caminho/ }).click()

  await expect(page).toHaveURL(/\/concursos\?q=Bombeiros(?:\+|%20)RJ/)
  await expect(page.getByRole('heading', { name: 'Soldado Bombeiro Militar' })).toBeVisible()
  await page.getByRole('link', { name: /Ver cenário/ }).click()

  await expect(page.getByRole('heading', { name: 'Soldado Bombeiro Militar' })).toBeVisible()
  await page.getByRole('link', { name: /Criar plano para este cargo/ }).click()

  await expect(page.getByLabel('Concurso de referência')).toHaveValue('cbmerj-soldado')
  await page.getByLabel('Horas por semana').fill('6')
  await page.getByRole('button', { name: /Gerar meu plano/ }).click()

  await expect(page).toHaveURL(/\/meu-plano\?novo=1/)
  await expect(page.getByRole('heading', { name: 'Soldado Bombeiro Militar' })).toBeVisible()

  const firstSession = page.locator('.plan-session').first()
  await firstSession.click()
  await expect(firstSession).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.progress-ring strong')).not.toHaveText('0%')
})
