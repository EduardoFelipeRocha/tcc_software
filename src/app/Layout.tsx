import {
  BookOpenCheck,
  Compass,
  Home,
  Menu,
  Route,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { DemoNotice } from '../shared/ui/DemoNotice'
import { Logo } from '../shared/ui/Logo'

const navItems = [
  { to: '/concursos', label: 'Explorar concursos' },
  { to: '/meu-plano', label: 'Meu plano' },
  { to: '/metodologia', label: 'Como funciona' },
]

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <DemoNotice />
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Navegação principal">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="button button-secondary header-plan" to="/planejamento/novo">
              Criar meu plano
              <Route size={17} aria-hidden="true" />
            </Link>
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="Menu principal">
            <div className="container">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
              <Link className="button button-primary" to="/planejamento/novo" onClick={() => setMenuOpen(false)}>
                Criar meu plano
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>Informação rastreável e estudo possível para quem busca o serviço público.</p>
          </div>
          <div>
            <h2>Produto</h2>
            <Link to="/concursos">Explorar concursos</Link>
            <Link to="/planejamento/novo">Criar plano</Link>
            <Link to="/metodologia">Metodologia</Link>
          </div>
          <div>
            <h2>Compromisso</h2>
            <span><ShieldCheck size={15} /> Fontes identificadas</span>
            <span><BookOpenCheck size={15} /> Histórico contextualizado</span>
            <span><Compass size={15} /> Sem promessa de aprovação</span>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>Rumo é um protótipo acadêmico de TCC. Nome provisório.</p>
          <p>© 2026 Projeto Rumo</p>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
        <NavLink to="/" end>
          <Home size={20} />
          <span>Início</span>
        </NavLink>
        <NavLink to="/concursos">
          <Compass size={20} />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/meu-plano">
          <Route size={20} />
          <span>Meu plano</span>
        </NavLink>
      </nav>
    </div>
  )
}
