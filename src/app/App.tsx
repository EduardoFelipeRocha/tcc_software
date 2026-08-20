import { Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { ContestDetailPage } from '../pages/ContestDetailPage'
import { ExplorePage } from '../pages/ExplorePage'
import { HomePage } from '../pages/HomePage'
import { MethodologyPage } from '../pages/MethodologyPage'
import { MyPlanPage } from '../pages/MyPlanPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlannerPage } from '../pages/PlannerPage'
import { RegisterPage } from '../pages/RegisterPage'
import { LoginPage } from '../pages/LoginPage'
import { AccountPage } from '../pages/AccountPage'
import { PreviousExamsPage } from '../pages/PreviousExamsPage'

export function App() {
  return (
    <Routes>
      <Route path="cadastro" element={<RegisterPage />} />
      <Route path="entrar" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="concursos" element={<ExplorePage />} />
        <Route path="concursos/:slug" element={<ContestDetailPage />} />
        <Route path="provas-anteriores" element={<PreviousExamsPage />} />
        <Route path="planejamento/novo" element={<PlannerPage />} />
        <Route path="meu-plano" element={<MyPlanPage />} />
        <Route path="metodologia" element={<MethodologyPage />} />
        <Route path="conta" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
