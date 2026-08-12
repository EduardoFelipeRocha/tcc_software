import { Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { ContestDetailPage } from '../pages/ContestDetailPage'
import { ExplorePage } from '../pages/ExplorePage'
import { HomePage } from '../pages/HomePage'
import { MethodologyPage } from '../pages/MethodologyPage'
import { MyPlanPage } from '../pages/MyPlanPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlannerPage } from '../pages/PlannerPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="concursos" element={<ExplorePage />} />
        <Route path="concursos/:slug" element={<ContestDetailPage />} />
        <Route path="planejamento/novo" element={<PlannerPage />} />
        <Route path="meu-plano" element={<MyPlanPage />} />
        <Route path="metodologia" element={<MethodologyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
