import { HashRouter, Link, NavLink, Route, Routes, useMatch } from 'react-router'
import { useAutoSync } from './sync/useAutoSync'
import { OpenLinkPage } from './ui/pages/OpenLinkPage'
import { PlantDetailPage } from './ui/pages/PlantDetailPage'
import { PlantFormPage } from './ui/pages/PlantFormPage'
import { PlantsPage } from './ui/pages/PlantsPage'
import { SettingsPage } from './ui/pages/SettingsPage'
import { SharedViewPage } from './ui/pages/SharedViewPage'
import { SharePage } from './ui/pages/SharePage'
import { TodayPage } from './ui/pages/TodayPage'
import { WhatsNewPage } from './ui/pages/WhatsNewPage'

export default function App() {
  useAutoSync()
  return (
    // Hash routing keeps deep links working on GitHub Pages without server rewrites.
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

function Shell() {
  // Someone else's shared plants: no tabs, so it can't be mistaken for your own collection.
  const viewing = useMatch('/view/*')
  return (
    <>
      <header className="topbar">
        <h1>🌿 fronds</h1>
        {viewing && (
          <div className="viewer-bar">
            <span>👀 Viewing a shared copy</span>
            <Link to="/plants">Close</Link>
          </div>
        )}
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/plants" element={<PlantsPage />} />
          <Route path="/plants/new" element={<PlantFormPage />} />
          <Route path="/plants/share" element={<SharePage />} />
          <Route path="/plants/open" element={<OpenLinkPage />} />
          <Route path="/plants/:id" element={<PlantDetailPage />} />
          <Route path="/plants/:id/edit" element={<PlantFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/whats-new" element={<WhatsNewPage />} />
          <Route path="/view/:data" element={<SharedViewPage />} />
          <Route path="/view/:data/:index" element={<SharedViewPage />} />
        </Routes>
      </main>
      {!viewing && (
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
      )}
    </>
  )
}
