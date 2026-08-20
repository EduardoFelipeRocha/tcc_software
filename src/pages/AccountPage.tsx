import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AvatarPresetPreview, ProfileAvatar } from '../features/auth/ProfileAvatar'
import { avatarPresets } from '../features/auth/avatarPresets'
import { prepareProfileImage } from '../features/auth/profileImage'
import type { AvatarPresetId } from '../features/auth/types'
import { useAuth } from '../features/auth/useAuth'
import { studyRepository, type StudyLibrary, type StudyState } from '../features/planner/studyRepository'

export function AccountPage() {
  const { user, loading, logout, updateAvatar } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deleteDialogRef = useRef<HTMLElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteDialogWasOpen = useRef(false)
  const [signingOut, setSigningOut] = useState(false)
  const [library, setLibrary] = useState<StudyLibrary | null>(null)
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<StudyState | null>(null)
  const [deletingPlanId, setDeletingPlanId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    void studyRepository.loadAccount()
      .then((result) => {
        if (active) setLibrary(result)
      })
      .catch((error: unknown) => {
        if (active) setPlansError(error instanceof Error ? error.message : 'Não foi possível carregar seus planos.')
      })
      .finally(() => {
        if (active) setPlansLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!pendingDelete) return
    const dialog = deleteDialogRef.current
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingPlanId) {
        event.preventDefault()
        setPendingDelete(null)
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleDialogKeys)
    return () => window.removeEventListener('keydown', handleDialogKeys)
  }, [deletingPlanId, pendingDelete])

  useEffect(() => {
    if (pendingDelete) {
      deleteDialogWasOpen.current = true
      return
    }
    if (deleteDialogWasOpen.current) {
      deleteDialogWasOpen.current = false
      deleteTriggerRef.current?.focus()
    }
  }, [pendingDelete])

  useEffect(() => {
    if (!pendingDelete) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [pendingDelete])

  if (loading) return <div className="container page-loading">Carregando sua conta…</div>
  if (!user && signingOut) return <Navigate to="/" replace />
  if (!user) return <Navigate to="/entrar?returnTo=/conta" replace />

  const signOut = async () => {
    setSigningOut(true)
    await logout()
    navigate('/')
  }

  const saveAvatar = async (avatar: Parameters<typeof updateAvatar>[0]) => {
    setAvatarSaving(true)
    setAvatarError('')
    setAvatarMessage('')
    try {
      await updateAvatar(avatar)
      setAvatarMessage(
        avatar?.type === 'preset'
          ? 'Avatar atualizado.'
          : avatar
            ? 'Foto de perfil atualizada.'
            : 'Foto de perfil removida.',
      )
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Não foi possível atualizar sua foto.')
    } finally {
      setAvatarSaving(false)
    }
  }

  const choosePreset = (preset: AvatarPresetId) => {
    void saveAvatar({ type: 'preset', preset })
  }

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarSaving(true)
    setAvatarError('')
    setAvatarMessage('Processando sua foto…')
    try {
      const avatar = await prepareProfileImage(file)
      await updateAvatar(avatar)
      setAvatarMessage('Foto enviada e ajustada com sucesso.')
    } catch (error) {
      setAvatarMessage('')
      setAvatarError(error instanceof Error ? error.message : 'Não foi possível processar esta foto.')
    } finally {
      setAvatarSaving(false)
    }
  }

  const deletePlan = async () => {
    if (!pendingDelete) return
    setDeletingPlanId(pendingDelete.plan.contestId)
    setDeleteError('')
    try {
      const updatedLibrary = await studyRepository.deleteAccountPlan(pendingDelete.plan.contestId)
      const guestPlan = studyRepository.loadGuest()
      if (guestPlan?.plan.contestId === pendingDelete.plan.contestId) studyRepository.clearGuest()
      setLibrary(updatedLibrary)
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir o plano.')
    } finally {
      setDeletingPlanId('')
    }
  }

  return (
    <div className="page account-page">
      <section className="account-hero">
        <div className="container account-hero-inner">
          <div className="account-hero-profile">
            <ProfileAvatar avatar={user.avatar} name={user.name} className="account-hero-avatar" />
            <div>
            <p className="kicker light"><ShieldCheck size={15} /> Área pessoal</p>
            <h1>Olá, {user.name.split(' ')[0]}.</h1>
            <p>Acesse seus planos salvos e continue exatamente de onde parou.</p>
            </div>
          </div>
          <Link className="button button-accent" to="/planejamento/novo"><Plus size={17} /> Criar outro plano</Link>
        </div>
      </section>

      <div className="container account-content">
        <section className="account-plans-section" aria-labelledby="account-plans-title">
          <div className="section-heading split-heading">
            <div><p className="kicker"><BookOpenCheck size={15} /> Biblioteca pessoal</p><h2 id="account-plans-title">Meus planos de estudo</h2></div>
            <p>Um plano por objetivo, cada um com seu próprio progresso.</p>
          </div>

          {plansLoading ? (
            <p className="account-plan-message">Carregando seus planos…</p>
          ) : plansError ? (
            <p className="form-error">{plansError}</p>
          ) : library && library.plans.length > 0 ? (
            <div className="account-plan-grid">
              {library.plans.map((state) => {
                const total = state.plan.sessions.length
                const completed = state.completedSessionIds.length
                const progress = total ? Math.round((completed / total) * 100) : 0
                const isCompleted = total > 0 && completed === total
                return (
                  <article className={`account-plan-card${isCompleted ? ' account-plan-completed' : ''}${deletingPlanId === state.plan.contestId ? ' is-deleting' : ''}`} key={state.plan.contestId}>
                    <div className="account-plan-topline">
                      <span className="organization-monogram">{state.plan.organization.slice(0, 3)}</span>
                      <span className="account-plan-status">
                        {isCompleted && <CheckCircle2 size={14} />}
                        {isCompleted ? 'Plano concluído' : library.activePlanId === state.plan.contestId ? 'Plano ativo' : 'Plano salvo'}
                      </span>
                      <button
                        className="plan-delete-button"
                        type="button"
                        aria-label={`Excluir plano ${state.plan.contestTitle}`}
                        title="Excluir plano"
                        onClick={(event) => {
                          deleteTriggerRef.current = event.currentTarget
                          setDeleteError('')
                          setPendingDelete(state)
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <h3>{state.plan.contestTitle}</h3>
                    <p className="account-plan-reference">{state.plan.referenceLabel}</p>
                    <div className="account-plan-progress"><span style={{ width: `${progress}%` }} /></div>
                    <dl>
                      <div><dt><Target size={14} /> Progresso</dt><dd>{progress}%</dd></div>
                      <div><dt><Clock3 size={14} /> Rotina</dt><dd>{state.plan.hoursPerWeek}h/semana</dd></div>
                      <div><dt><BookOpenCheck size={14} /> Matérias</dt><dd>{state.plan.subjects.length}</dd></div>
                    </dl>
                    {isCompleted && <p className="completed-plan-note"><CheckCircle2 size={15} /> Você concluiu todas as sessões. O plano continua disponível para revisão.</p>}
                    <Link className={`button ${isCompleted ? 'button-completed' : 'button-primary'}`} to={`/meu-plano?plano=${encodeURIComponent(state.plan.contestId)}`}>
                      {isCompleted ? 'Revisar plano' : 'Continuar estudando'} <ArrowRight size={16} />
                    </Link>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="account-no-plans">
              <BookOpenCheck size={30} />
              <h3>Você ainda não criou um plano.</h3>
              <p>Escolha um concurso com conteúdo oficial validado e monte sua primeira semana.</p>
              <Link className="button button-accent" to="/planejamento/novo">Criar meu plano</Link>
            </div>
          )}
        </section>

        <div className="account-secondary-grid">
          <section className="account-card">
            <ProfileAvatar avatar={user.avatar} name={user.name} className="account-profile-avatar" />
            <div><p className="eyebrow">Perfil</p><h2>{user.name}</h2></div>
            <dl>
              <div><dt><Mail size={15} /> E-mail</dt><dd>{user.email}</dd></div>
              <div><dt><CalendarDays size={15} /> Conta criada</dt><dd>{new Intl.DateTimeFormat('pt-BR').format(new Date(user.createdAt))}</dd></div>
            </dl>
            <button className="button button-secondary" type="button" onClick={signOut} disabled={signingOut}>
              <LogOut size={17} /> {signingOut ? 'Saindo…' : 'Sair da conta'}
            </button>
          </section>
          <section className="account-avatar-editor" aria-labelledby="avatar-editor-title">
            <div className="avatar-editor-heading">
              <span><Camera size={21} /></span>
              <div><p className="kicker">Personalização</p><h2 id="avatar-editor-title">Sua foto ou avatar</h2></div>
            </div>
            <p>Envie uma foto do computador ou escolha um dos avatares. A imagem enviada é recortada, reduzida e salva apenas no perfil desta conta.</p>

            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              aria-label="Selecionar foto do computador"
            />
            <button className="button button-secondary avatar-upload-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarSaving}>
              <Upload size={17} /> {avatarSaving ? 'Salvando…' : 'Enviar foto do computador'}
            </button>
            <small className="avatar-upload-help">JPEG, PNG ou WebP · até 5 MB antes do ajuste automático.</small>

            <fieldset className="avatar-preset-fieldset" disabled={avatarSaving}>
              <legend>Ou escolha um avatar</legend>
              <div className="avatar-preset-grid">
                {avatarPresets.map((preset) => {
                  const selected = user.avatar?.type === 'preset' && user.avatar.preset === preset.id
                  return (
                    <button
                      className={selected ? 'selected' : ''}
                      type="button"
                      key={preset.id}
                      aria-label={`Escolher avatar ${preset.label}`}
                      aria-pressed={selected}
                      onClick={() => choosePreset(preset.id)}
                    >
                      <AvatarPresetPreview presetId={preset.id} />
                      <span>{preset.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="avatar-editor-footer">
              {user.avatar && <button className="text-button danger-text-button" type="button" onClick={() => void saveAvatar(null)} disabled={avatarSaving}><Trash2 size={15} /> Remover foto/avatar</button>}
              {avatarMessage && <p className="avatar-success" role="status">{avatarMessage}</p>}
              {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
            </div>
          </section>
        </div>

        <section className="account-security-note">
          <div><ShieldCheck size={20} /><div><p className="kicker">Privacidade e segurança</p><h2>Proteção adequada ao MVP acadêmico</h2></div></div>
          <p>A senha usa scrypt e sal individual; a sessão usa cookie HTTP-only. Para produção ainda serão necessários verificação de e-mail, recuperação de senha, armazenamento dedicado de imagens, backups e autenticação em dois fatores.</p>
        </section>
      </div>

      {pendingDelete && (
        <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !deletingPlanId) setPendingDelete(null)
        }}>
          <section ref={deleteDialogRef} className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title" aria-describedby="delete-plan-description">
            <button className="dialog-close-button" type="button" aria-label="Fechar confirmação" onClick={() => setPendingDelete(null)} disabled={Boolean(deletingPlanId)}><X size={19} /></button>
            <span className="dialog-danger-icon"><Trash2 size={23} /></span>
            <p className="eyebrow">Excluir plano</p>
            <h2 id="delete-plan-title">Excluir “{pendingDelete.plan.contestTitle}”?</h2>
            <p id="delete-plan-description">Essa ação remove o plano e todo o progresso dele. Seus outros planos e sua conta não serão afetados.</p>
            {deleteError && <p className="form-error dialog-error" role="alert">{deleteError}</p>}
            <div className="dialog-actions">
              <button className="button button-secondary" type="button" autoFocus onClick={() => setPendingDelete(null)} disabled={Boolean(deletingPlanId)}>Cancelar</button>
              <button className="button button-danger" type="button" onClick={() => void deletePlan()} disabled={Boolean(deletingPlanId)}>{deletingPlanId ? 'Excluindo…' : 'Sim, excluir plano'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
