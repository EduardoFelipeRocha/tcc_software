import { describe, expect, it } from 'vitest'
import { officialContests, officialSources } from './contests'

describe('catálogo oficial', () => {
  it('mantém identificadores e slugs únicos', () => {
    expect(new Set(officialContests.map((contest) => contest.id)).size).toBe(officialContests.length)
    expect(new Set(officialContests.map((contest) => contest.slug)).size).toBe(officialContests.length)
  })

  it('identifica todo card municipal com nome e código IBGE consistentes', () => {
    const expectedMunicipalities = new Map([
      ['Saquarema', { municipalityIbgeCode: '3305505', uf: 'RJ' }],
      ['Santos', { municipalityIbgeCode: '3548500', uf: 'SP' }],
      ['Hortolândia', { municipalityIbgeCode: '3519071', uf: 'SP' }],
      ['Maricá', { municipalityIbgeCode: '3302700', uf: 'RJ' }],
      ['Delfinópolis', { municipalityIbgeCode: '3121209', uf: 'MG' }],
      ['Abaré', { municipalityIbgeCode: '2900207', uf: 'BA' }],
      ['Trindade', { municipalityIbgeCode: '5221403', uf: 'GO' }],
    ])
    const municipalContests = officialContests.filter(
      (contest) => contest.governmentLevel === 'Municipal',
    )

    expect(new Set(municipalContests.map((contest) => contest.municipalityName)))
      .toEqual(new Set(expectedMunicipalities.keys()))
    municipalContests.forEach((contest) => {
      expect(contest.municipalityName, `${contest.id} sem município`).toBeTruthy()
      expect(contest.municipalityIbgeCode, `${contest.id} sem código IBGE`)
        .toMatch(/^\d{7}$/)
      expect(
        expectedMunicipalities.get(contest.municipalityName ?? ''),
        `${contest.id} tem par município/código inconsistente`,
      ).toEqual({
        municipalityIbgeCode: contest.municipalityIbgeCode,
        uf: contest.uf,
      })
    })
  })

  it('publica somente registros com fonte oficial rastreável', () => {
    const sources = new Map(officialSources.map((source) => [source.id, source]))

    expect(officialContests.length).toBeGreaterThanOrEqual(20)
    officialContests.forEach((contest) => {
      expect(contest.evidence).not.toBe('projection')
      expect(contest.officialUrl).toMatch(/^https:\/\//)
      expect(contest.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(contest.salaryLabel).toBeTruthy()
      expect(contest.feeLabel).toBeTruthy()
      expect(contest.sourceIds.length).toBeGreaterThan(0)
      contest.sourceIds.forEach((sourceId) => {
        expect(sources.get(sourceId)?.official).toBe(true)
        expect(sources.get(sourceId)?.url).toMatch(/^https:\/\//)
      })
      expect(
        contest.sourceIds.some((sourceId) =>
          (sources.get(sourceId)?.checkedAt ?? '') >= contest.lastVerified),
        `${contest.id} declara verificação posterior às fontes`,
      ).toBe(true)
    })
  })

  it('oferece provas e gabaritos oficiais no acervo histórico', () => {
    const historicalMaterials = officialContests.filter(
      (contest) => contest.previousEdition.examUrl && contest.previousEdition.answerKeyUrl,
    )
    const inss = historicalMaterials.find((contest) => contest.acronym === 'INSS')

    expect(historicalMaterials.length).toBeGreaterThanOrEqual(4)
    expect(inss?.previousEdition.examSecondaryUrl).toMatch(/^https:\/\//)
    expect(inss?.previousEdition.answerKeySecondaryUrl).toMatch(/^https:\/\//)
  })

  it('mantém escolaridade e janela de inscrição coerentes com os cards publicados', () => {
    const delfinopolis = officialContests.find((contest) => contest.id === 'delfinopolis-diversos-2026')
    const trindade = officialContests.find((contest) => contest.id === 'camara-trindade-2026')
    const abare = officialContests.find((contest) => contest.id === 'abare-acs-2026')

    expect(delfinopolis?.education).toEqual(expect.arrayContaining([
      'Alfabetizado',
      'Nível fundamental',
      'Nível médio',
      'Nível técnico',
      'Nível superior',
    ]))
    expect(trindade?.education).toContain('Nível fundamental')
    expect(abare?.phase).toBe('in_progress')
    expect(abare?.deadlineLabel).toContain('encerradas em 12/08/2026')
  })

  it('publica a Guarda de Maricá como previsão sem inventar autorização, vagas ou cronograma', () => {
    const marica = officialContests.find((contest) => contest.id === 'marica-guarda-previsto-2026')
    const currentSource = officialSources.find((source) => source.id === 'marica-guarda-previsto-2026')

    expect(marica).toMatchObject({
      phase: 'expected',
      evidence: 'official_current',
      organization: 'Prefeitura de Maricá',
      uf: 'RJ',
      governmentLevel: 'Municipal',
      education: ['A confirmar no edital'],
      openingsLabel: 'Vagas não informadas oficialmente',
      salaryLabel: 'A confirmar em futuro edital',
      deadlineLabel: 'Previsto — sem edital ou cronograma oficial',
      feeLabel: 'A confirmar em futuro edital',
      organizer: 'Banca não definida',
    })
    expect(marica?.shortDescription).toContain('não havia ato formal de autorização')
    expect(marica?.applicationUrl).toBeUndefined()
    expect(marica?.registrationStartsAt).toBeUndefined()
    expect(marica?.registrationEndsAt).toBeUndefined()
    expect([
      marica?.openingsLabel,
      marica?.salaryLabel,
      marica?.deadlineLabel,
      marica?.feeLabel,
    ].join(' ')).not.toMatch(/\b(?:390|400)\b/)
    expect(currentSource).toMatchObject({
      publisher: 'Prefeitura de Maricá',
      checkedAt: '2026-08-14',
      official: true,
    })
    expect(currentSource?.url).toBe(marica?.officialUrl)
  })

  it('separa a matriz histórica de 2019 da previsão atual da Guarda de Maricá', () => {
    const marica = officialContests.find((contest) => contest.id === 'marica-guarda-previsto-2026')
    const historicalSource = officialSources.find((source) => source.id === 'marica-guarda-edital-2019')

    expect(marica?.studyReference).toMatchObject({
      type: 'previous_notice',
      year: 2019,
      contentVerifiedAt: '2026-08-14',
    })
    expect(marica?.studyReference?.note).toContain('não confirma matérias, requisitos ou pesos do próximo edital')
    expect(marica?.previousEdition).toMatchObject({
      year: 2019,
      organizer: 'UFF/Coseac',
      fee: 'R$ 70,00 na edição de 2019',
    })
    expect(marica?.previousEdition.note).toContain('exclusivamente históricos')
    expect(Object.fromEntries(
      marica?.subjects.map((subject) => [subject.id, subject.historicalWeight]) ?? [],
    )).toEqual({
      portugues: 20,
      'raciocinio-informatica': 20,
      especificos: 60,
    })
    expect(historicalSource?.official).toBe(true)
    expect(historicalSource?.publisher).toContain('UFF-Coseac')
    expect(marica?.sourceIds).toContain('marica-guarda-edital-2019')
  })

  it('mantém as matrizes prontas granulares, únicas e com pesos preservados', () => {
    const readyContests = officialContests.filter((contest) => contest.studyReference)

    expect(readyContests.length).toBeGreaterThanOrEqual(10)
    readyContests.forEach((contest) => {
      expect(contest.subjects.length).toBeGreaterThan(0)
      expect(contest.subjects.reduce((total, subject) => total + subject.historicalWeight, 0)).toBeCloseTo(100, 1)
      expect(new Set(contest.subjects.map((subject) => subject.id)).size).toBe(contest.subjects.length)

      contest.subjects.forEach((subject) => {
        expect(subject.topics.length, `${contest.id}/${subject.id}`).toBeGreaterThanOrEqual(12)
        expect(subject.topics.length, `${contest.id}/${subject.id}`).toBeLessThanOrEqual(500)
        expect(new Set(subject.topics).size, `${contest.id}/${subject.id}`).toBe(subject.topics.length)
        subject.topics.forEach((topic) => {
          expect(topic, `${contest.id}/${subject.id}`).toBe(topic.trim())
          expect(topic.length, `${contest.id}/${subject.id}`).toBeGreaterThanOrEqual(12)
          expect(topic.length, `${contest.id}/${subject.id}`).toBeLessThanOrEqual(500)
        })
      })
    })
  })

  it('não usa rótulos vagos conhecidos como tarefa de estudo', () => {
    const vagueLabels = new Set([
      'atribuições do cargo',
      'compreensão e interpretação de textos',
      'conteúdo técnico',
      'ferramentas de escritório',
      'interpretação',
      'interpretação de textos',
      'internet e segurança',
      'legislação profissional',
      'morfossintaxe',
      'normas do órgão',
      'ortografia e acentuação',
      'princípios administrativos',
      'raciocínio lógico',
      'raciocínio lógico e situações-problema',
      'resolução de problemas',
      'resolução de situações-problema',
      'sistemas operacionais',
    ])
    const readyTopics = officialContests
      .filter((contest) => contest.studyReference)
      .flatMap((contest) => contest.subjects.flatMap((subject) => subject.topics))

    readyTopics.forEach((topic) => {
      expect(vagueLabels.has(topic.trim().toLocaleLowerCase('pt-BR')), topic).toBe(false)
    })
  })

  it('transforma o item amplo de raciocínio da PMESP em treino prático sem fingir delimitação oficial', () => {
    const pmesp = officialContests.find((contest) => contest.id === 'pmesp-aluno-soldado-2026')
    const math = pmesp?.subjects.find((subject) => subject.id === 'matematica')
    const practicalBreakdown = math?.topics.filter(
      (topic) => topic.startsWith('Raciocínio lógico') || topic.startsWith('Situações-problema'),
    ) ?? []

    expect(practicalBreakdown.length).toBeGreaterThanOrEqual(10)
    practicalBreakdown.forEach((topic) => {
      expect(topic).toContain('treino sugerido')
      expect(topic).toContain('item amplo do Anexo B')
    })
  })

  it('oferece checklists extensos de Português inclusive nas matrizes mistas', () => {
    const readyContests = officialContests.filter((contest) => contest.studyReference)
    const portugueseSubjects = readyContests.flatMap((contest) =>
      contest.subjects.filter((subject) => subject.name === 'Língua Portuguesa'),
    )
    const inssBasics = readyContests
      .find((contest) => contest.id === 'inss-tecnico-seguro-social-2022')
      ?.subjects.find((subject) => subject.id === 'inss-2022-basicos')
    const cbmerjLanguages = readyContests
      .find((contest) => contest.id === 'cbmerj-cadete-2024')
      ?.subjects.find((subject) => subject.id === 'linguagens')

    expect(portugueseSubjects.length).toBeGreaterThanOrEqual(8)
    portugueseSubjects.forEach((subject) => expect(subject.topics.length).toBeGreaterThanOrEqual(20))
    expect(inssBasics?.topics.filter((topic) => topic.startsWith('Português')).length).toBeGreaterThanOrEqual(20)
    expect(cbmerjLanguages?.topics.filter((topic) => topic.startsWith('Português')).length).toBeGreaterThanOrEqual(20)
  })
})
