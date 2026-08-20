import {
  BookOpenCheck,
  Compass,
  Home,
  LogIn,
  Menu,
  Route,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ProfileAvatar } from '../features/auth/ProfileAvatar'
import { useAuth } from '../features/auth/useAuth'
import { Logo } from '../shared/ui/Logo'
import { ThemeToggle } from '../shared/ui/ThemeToggle'

const navItems = [
  { to: '/concursos', label: 'Explorar concursos' },
  { to: '/provas-anteriores', label: 'Provas anteriores' },
  { to: '/meu-plano', label: 'Meu plano' },
  { to: '/metodologia', label: 'Como funciona' },
]

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, loading } = useAuth()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
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
            <ThemeToggle />
            {!loading && (user ? (
              <Link className="account-button" to="/conta" aria-label="Abrir minha conta">
                <ProfileAvatar avatar={user.avatar} name={user.name} className="header-profile-avatar" />
                <b>{user.name.split(' ')[0]}</b>
              </Link>
            ) : (
              <div className="auth-actions">
                <Link className="login-link" to="/entrar"><LogIn size={16} /> Entrar</Link>
                <Link className="button button-primary register-link" to="/cadastro">Criar conta</Link>
              </div>
            ))}
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
              {user ? (
                <Link className="button button-primary" to="/conta" onClick={() => setMenuOpen(false)}><UserRound size={17} /> Minha conta</Link>
              ) : (
                <div className="mobile-auth-actions">
                  <Link className="button button-secondary" to="/entrar" onClick={() => setMenuOpen(false)}>Entrar</Link>
                  <Link className="button button-primary" to="/cadastro" onClick={() => setMenuOpen(false)}>Criar conta</Link>
                </div>
              )}
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
            <Link to="/provas-anteriores">Provas anteriores</Link>
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
          <p>Dados verificados em fontes oficiais. Consulte sempre o edital vigente.</p>
          <p>© 2026 GuiaConcursos</p>
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
