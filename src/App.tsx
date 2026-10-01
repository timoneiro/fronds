import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { useAutoSync } from './sync/useAutoSync'
import { UpdateBanner } from './ui/components/UpdateBanner'
import { PlantDetailPage } from './ui/pages/PlantDetailPage'
import { PlantFormPage } from './ui/pages/PlantFormPage'
import { PlantsPage } from './ui/pages/PlantsPage'
import { SettingsPage } from './ui/pages/SettingsPage'
import { TodayPage } from './ui/pages/TodayPage'
import { WhatsNewPage } from './ui/pages/WhatsNewPage'

export default function App() {
  useAutoSync()
  return (
    // Hash routing keeps deep links working on GitHub Pages without server rewrites.
    <HashRouter>
      <header className="topbar">
        <h1>🌿 fronds</h1>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/plants" element={<PlantsPage />} />
          <Route path="/plants/new" element={<PlantFormPage />} />
          <Route path="/plants/:id" element={<PlantDetailPage />} />
          <Route path="/plants/:id/edit" element={<PlantFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/whats-new" element={<WhatsNewPage />} />
        </Routes>
      </main>
      <UpdateBanner />
      <nav className="tabbar">
        <NavLink to="/" end>
          <span aria-hidden>💧</span>Today
        </NavLink>
        <NavLink to="/plants">
          <span aria-hidden>🪴</span>Plants
        </NavLink>
        <NavLink to="/settings">
          <span aria-hidden>⚙️</span>Settings
        </NavLink>
      </nav>
    </HashRouter>
  )
}
