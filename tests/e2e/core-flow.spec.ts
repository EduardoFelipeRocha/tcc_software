import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

test('busca concurso, cria conta, gera plano e retoma o progresso', async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@guiaconcursos.test`

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Seu próximo cargo/ })).toBeVisible()
  await page.getByLabel('Qual concurso você quer conquistar?').fill('Bombeiros RJ')
  await page.getByRole('button', { name: /Encontrar meu caminho/ }).click()

  await expect(page).toHaveURL(/\/concursos\?q=Bombeiros(?:\+|%20)RJ/)
  await expect(page.getByRole('heading', { name: 'Cadete Bombeiro Militar' })).toBeVisible()
  await page.getByRole('link', { name: /Ver detalhes/ }).click()

  await expect(page.getByRole('heading', { name: 'Cadete Bombeiro Militar' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir prova/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver gabarito/ })).toBeVisible()
  await page.getByRole('link', { name: /Criar plano para este cargo/ }).click()

  await expect(page.getByLabel('Concurso de referência')).toHaveValue('cbmerj-cadete-2024')
  await page.getByLabel('Horas por semana').fill('6')
  await page.getByRole('button', { name: /Gerar meu plano/ }).click()

  await expect(page).toHaveURL(/\/cadastro\?plano=1/)
  await page.getByLabel('Nome').fill('Pessoa Teste')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSegura123!')
  await page.getByLabel('Confirmar senha').fill('SenhaSegura123!')
  await page.getByRole('button', { name: /Criar conta/ }).click()

  await expect(page).toHaveURL(/\/meu-plano\?novo=1/)
  const testDataFile = process.env.GUIACONCURSOS_E2E_DATA_FILE
  expect(testDataFile).toBeTruthy()
  expect(readFileSync(testDataFile!, 'utf8')).not.toContain('SenhaSegura123!')
  await expect(page.getByRole('heading', { name: 'Cadete Bombeiro Militar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Matérias e tópicos/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir edital usado neste plano/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir provas e materiais da edição/ })).toBeVisible()
  await expect(page.locator('.plan-subject-card')).toHaveCount(4)

  const firstSubject = page.locator('.plan-subject-card').first()
  const secondSubject = page.locator('.plan-subject-card').nth(1)
  await expect(firstSubject.locator('.subject-topic-panel')).toBeHidden()
  await firstSubject.locator('summary').click()
  await expect(firstSubject.locator('.subject-topic-panel')).toBeVisible()
  await expect(firstSubject.locator('li').first()).toBeVisible()
  await expect(page.locator('.plan-subject-card[open]')).toHaveCount(1)
  await expect(secondSubject.locator('.subject-topic-panel')).toBeHidden()
  await secondSubject.locator('summary').click()
  await expect(firstSubject.locator('.subject-topic-panel')).toBeHidden()
  await expect(secondSubject.locator('.subject-topic-panel')).toBeVisible()
  await expect(page.locator('.plan-subject-card[open]')).toHaveCount(1)
  await secondSubject.locator('summary').click()
  await expect(page.locator('.plan-subject-card[open]')).toHaveCount(0)

  const firstSession = page.locator('.plan-session').first()
  await firstSession.click()
  await expect(firstSession).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Progresso salvo')).toBeVisible()

  await page.reload()
  await expect(page.locator('.plan-session').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.progress-ring strong')).not.toHaveText('0%')

  await page.goto('/planejamento/novo?concurso=inss-tecnico-seguro-social-2022')
  await expect(page.getByLabel('Concurso de referência')).toHaveValue('inss-tecnico-seguro-social-2022')
  await page.getByLabel('Horas por semana').fill('4')
  await page.getByRole('button', { name: /Gerar meu plano/ }).click()
  await expect(page).toHaveURL(/\/meu-plano\?novo=1/)
  await expect(page.getByRole('heading', { name: 'Técnico do Seguro Social' })).toBeVisible()

  await page.goto('/conta')
  await expect(page.locator('.account-plan-card')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Cadete Bombeiro Militar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Técnico do Seguro Social' })).toBeVisible()
  const firefighterPlan = page.locator('.account-plan-card').filter({
    has: page.getByRole('heading', { name: 'Cadete Bombeiro Militar' }),
  })
  await firefighterPlan.getByRole('link', { name: /Continuar estudando/ }).click()
  await expect(page).toHaveURL(/plano=cbmerj-cadete-2024/)
  await expect(page.locator('.plan-session').first()).toHaveAttribute('aria-pressed', 'true')

  const sessions = page.locator('.plan-session')
  for (let index = 0; index < await sessions.count(); index += 1) {
    const session = sessions.nth(index)
    if (await session.getAttribute('aria-pressed') !== 'true') await session.click()
  }
  await expect(page.getByText('Progresso salvo')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/concluiu todas as sessões deste plano/)).toBeVisible()

  await page.goto('/conta')
  const completedFirefighterPlan = page.locator('.account-plan-card').filter({
    has: page.getByRole('heading', { name: 'Cadete Bombeiro Militar' }),
  })
  await expect(completedFirefighterPlan.getByText('Plano concluído')).toBeVisible()
  await expect(completedFirefighterPlan.getByRole('link', { name: /Revisar plano/ })).toBeVisible()

  await page.getByRole('button', { name: 'Escolher avatar Mulher — violeta' }).click()
  await expect(page.getByText('Avatar atualizado.')).toBeVisible()
  await expect(page.locator('.header-profile-avatar.profile-avatar-preset')).toBeVisible()
  await page.reload()
  await expect(page.locator('.header-profile-avatar.profile-avatar-preset')).toBeVisible()

  const pngPixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  await page.getByLabel('Selecionar foto do computador').setInputFiles({
    name: 'foto-perfil.png',
    mimeType: 'image/png',
    buffer: pngPixel,
  })
  await expect(page.getByText('Foto enviada e ajustada com sucesso.')).toBeVisible()
  await expect(page.locator('img.header-profile-avatar')).toHaveAttribute('src', /^data:image\/(?:webp|jpeg);base64,/)
  await page.reload()
  await expect(page.locator('img.header-profile-avatar')).toHaveAttribute('src', /^data:image\/(?:webp|jpeg);base64,/)

  const inssPlan = page.locator('.account-plan-card').filter({
    has: page.getByRole('heading', { name: 'Técnico do Seguro Social' }),
  })
  await inssPlan.getByRole('button', { name: /Excluir plano/ }).click()
  await expect(page.getByRole('dialog', { name: /Excluir “Técnico do Seguro Social”/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.account-plan-card')).toHaveCount(2)
  await expect(inssPlan.getByRole('button', { name: /Excluir plano/ })).toBeFocused()
  await inssPlan.getByRole('button', { name: /Excluir plano/ }).click()
  await page.getByRole('button', { name: 'Sim, excluir plano' }).click()
  await expect(page.locator('.account-plan-card')).toHaveCount(1)
  await expect(completedFirefighterPlan.getByText('Plano concluído')).toBeVisible()

  await page.goto('/meu-plano?plano=inss-tecnico-seguro-social-2022')
  await expect(page.getByRole('heading', { name: 'Esse plano não está mais disponível.' })).toBeVisible()
  await page.getByRole('link', { name: /Ver meus planos/ }).click()

  await page.getByRole('button', { name: /Sair da conta/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/entrar?returnTo=%2Fmeu-plano%3Fplano%3Dcbmerj-cadete-2024')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Senha').fill('SenhaSegura123!')
  await page.getByRole('button', { name: /^Entrar/ }).click()
  await expect(page).toHaveURL(/plano=cbmerj-cadete-2024/)
  await expect(page.locator('.plan-session').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/concluiu todas as sessões deste plano/)).toBeVisible()
})

test('alterna e persiste o tema em todas as áreas do site', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('guiaconcursos-theme'))
  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#091215')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/entrar')
  await expect(page.getByRole('button', { name: 'Ativar tema claro' })).toBeVisible()
  await page.getByRole('button', { name: 'Ativar tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('catálogo oferece filtros para ativos, previstos e provas anteriores', async ({ page }) => {
  await page.goto('/concursos')

  await expect(page.getByLabel('Localização exata')).toHaveValue('all')
  await expect(page.getByLabel('Localização exata').locator('option').first()).toContainText('Todos os locais')
  await expect(page.getByLabel('Escolaridade').locator('option[value="Nível intermediário"]')).toHaveCount(1)

  await page.goto('/concursos?escolaridade=valor-invalido&area=valor-invalido&municipio=0000000')
  await expect(page).not.toHaveURL(/valor-invalido/)
  await expect(page).not.toHaveURL(/municipio=/)
  await expect(page.getByLabel('Escolaridade')).toHaveValue('all')
  await expect(page.getByLabel('Área')).toHaveValue('all')
  await expect(page.getByLabel('Município')).toHaveValue('all')
  await expect(page.locator('.active-filter-count')).toHaveText('0 filtros ativos')

  await page.getByLabel('Buscar concursos').fill('INSS')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByLabel('Escolaridade').locator('option[value="Nível fundamental"]')).toBeDisabled()
  await page.getByRole('button', { name: 'Limpar busca' }).click()

  await page.getByLabel('Localização exata').selectOption('SP')
  await expect(page.getByRole('heading', { name: /7 de 22 registros encontrados/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Analista-Tributário e Auditor-Fiscal/ })).toHaveCount(0)

  await page.getByLabel('Localização exata').selectOption('all')
  await page.getByLabel('Buscar concursos').fill('Concursos federais')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByRole('heading', { name: /Analista-Tributário e Auditor-Fiscal/ })).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca' }).click()
  await expect(page).not.toHaveURL(/(?:\?|&)q=/)

  await page.getByLabel('Buscar concursos').fill('Guarda Municipal Maricá')
  await page.getByRole('button', { name: 'Buscar' }).click()
  const maricaCard = page.locator('.contest-card').filter({ hasText: 'GUARDA MARICÁ' })
  await expect(maricaCard).toHaveCount(1)
  await expect(maricaCard.locator('.phase-expected')).toHaveText('Previsto')
  await expect(maricaCard).toContainText('não havia ato formal de autorização')
  await page.getByRole('button', { name: 'Limpar busca' }).click()

  await page.getByLabel('Localização exata').selectOption('RJ')
  await page.getByLabel('Município').selectOption('3302700')
  await expect(page.getByRole('heading', { name: /1 de 22 registros encontrados/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Guarda Municipal' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpar' }).click()

  await page.getByLabel('Situação').selectOption('in_progress')
  await expect(page.getByRole('heading', { name: 'Agente Comunitário de Saúde' })).toBeVisible()
  await expect(page.locator('.phase-in_progress')).toHaveText(/Em andamento/)

  await page.getByLabel('Situação').selectOption('preparation')
  await expect(page.getByRole('heading', { name: /Analista-Tributário e Auditor-Fiscal/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Auditor e Técnico/ })).toBeVisible()
  await page.getByLabel('Situação').selectOption('closed')
  await expect(page.getByRole('heading', { name: /Técnico do Seguro Social/ })).toBeVisible()

  const healthResponse = await page.request.get('/api/catalog/health')
  expect(healthResponse.ok()).toBe(true)
  const health = await healthResponse.json() as { total: number; regionalUnitsCovered: number; stale: number }
  expect(health.total).toBeGreaterThanOrEqual(22)
  expect(health.regionalUnitsCovered).toBeGreaterThanOrEqual(6)
  expect(health.stale).toBeGreaterThanOrEqual(0)

  await page.getByRole('button', { name: 'Avisar concurso ausente' }).click()
  await page.getByLabel('Concurso ou cargo').fill('Analista de teste')
  await page.getByLabel('Órgão').fill('Prefeitura de Testópolis')
  await page.getByLabel('Município').fill('Testópolis')
  await page.getByLabel('UF').selectOption('RJ')
  await page.getByLabel('Link oficial, se houver').fill('https://example.gov.br/concurso')
  await page.getByRole('button', { name: 'Enviar para o radar' }).click()
  await expect(page.getByText(/Indicação recebida\. Protocolo: GC-/)).toBeVisible()

  await page.goto('/provas-anteriores')
  await expect(page.getByRole('heading', { name: /Provas anteriores e gabaritos/ })).toBeVisible()
  const inssCard = page.locator('.exam-library-card').filter({
    has: page.getByRole('heading', { name: 'Técnico do Seguro Social' }),
  })
  await expect(inssCard.getByRole('link', { name: 'Abrir prova' })).toBeVisible()
  await expect(inssCard.getByRole('link', { name: 'Prova específica' })).toBeVisible()
  await expect(inssCard.getByRole('link', { name: 'Gabarito', exact: true })).toBeVisible()
  await expect(inssCard.getByRole('link', { name: 'Gabarito específico' })).toBeVisible()

  await page.goto('/planejamento/novo?concurso=ifsc-tecnicos-administrativos-2026')
  await expect(page.getByLabel('Concurso de referência')).toHaveValue('')
  await expect(page.getByText(/não pode gerar um plano único/)).toBeVisible()
  await expect(page.getByText(/Selecione primeiro o cargo e o nível/)).toBeVisible()

  await page.goto('/planejamento/novo?concurso=pmesp-aluno-soldado-2026')
  await expect(page.getByLabel('Concurso de referência')).toHaveValue('pmesp-aluno-soldado-2026')
  await expect(page.getByText('Edição anterior para comparação')).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir material anterior/ })).toBeVisible()
})

test('catálogo não cria rolagem horizontal em telas menores', async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/concursos')
    await expect(page.locator('.catalog-grid .contest-card').first()).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    expect(dimensions.document, `documento em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
    expect(dimensions.body, `body em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
  }
})

test('migra um plano legado sem fingir que a fonte foi validada', async ({ page }) => {
  const uniqueEmail = `legado-${Date.now()}@guiaconcursos.test`
  const testDataFile = process.env.GUIACONCURSOS_E2E_DATA_FILE
  expect(testDataFile).toBeTruthy()

  await page.goto('/cadastro?returnTo=/meu-plano')
  await page.getByLabel('Nome').fill('Pessoa Legado')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Senha', { exact: true }).fill('SenhaLegado123!')
  await page.getByLabel('Confirmar senha').fill('SenhaLegado123!')
  await page.getByRole('button', { name: /Criar conta/ }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/meu-plano')

  const database = JSON.parse(readFileSync(testDataFile!, 'utf8')) as {
    users: Array<{ id: string; email: string }>
    sessions: unknown[]
    studies: Record<string, unknown>
  }
  const user = database.users.find((candidate) => candidate.email === uniqueEmail)
  expect(user).toBeTruthy()
  database.studies[user!.id] = {
    plan: {
      version: 1,
      algorithmVersion: '1.0.0',
      contestId: 'plano-legado',
      contestSlug: 'plano-legado',
      contestTitle: 'Plano antigo preservado',
      organization: 'Órgão legado',
      referenceLabel: 'Referência da versão anterior',
      generatedAt: '2026-08-10T12:00:00.000Z',
      hoursPerWeek: 1,
      weekdays: ['SEG', 'TER'],
      sessions: [
        { id: 'legado-1', weekday: 'SEG', subjectId: 'portugues', subjectName: 'Português', minutes: 30, kind: 'Teoria + resumo' },
        { id: 'legado-2', weekday: 'TER', subjectId: 'direito', subjectName: 'Direito', minutes: 30, kind: 'Questões' },
      ],
    },
    completedSessionIds: ['legado-1'],
    updatedAt: '2026-08-10T12:00:00.000Z',
  }
  writeFileSync(testDataFile!, JSON.stringify(database, null, 2), 'utf8')

  await page.goto('/meu-plano')
  await expect(page.getByRole('heading', { name: 'Plano antigo preservado' })).toBeVisible()
  await expect(page.getByText(/não tem base documental validada/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Recriar com base oficial/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir edital usado/ })).toHaveCount(0)
  await expect(page.locator('.plan-session').first()).toHaveAttribute('aria-pressed', 'true')
})
