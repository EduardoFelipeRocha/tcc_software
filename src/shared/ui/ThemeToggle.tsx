import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../features/theme/theme'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDarkTheme = theme === 'dark'
  const label = isDarkTheme ? 'Ativar tema claro' : 'Ativar tema escuro'

  return (
    <button
      className={`icon-button theme-toggle ${className}`.trim()}
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      {isDarkTheme ? <Sun aria-hidden="true" size={20} /> : <Moon aria-hidden="true" size={20} />}
    </button>
  )
}
