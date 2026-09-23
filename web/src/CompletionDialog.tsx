import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from 'react'

/** Native modal focus containment, Escape handling, and focus restoration. */
export function CompletionDialog({ open, title, description, onClose, children, success = false }: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  success?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const previousOverflow = document.body.style.overflow
    element.showModal()
    element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement?.tagName === 'H2')) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return <dialog ref={dialog} onKeyDown={containTab} className={`completion-dialog ${success ? 'completion-dialog--success' : ''}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <button type="button" className="dialog-close" aria-label="Закрыть окно" onClick={onClose}>×</button>
    {success ? <SuccessMark /> : <span className="dialog-symbol" aria-hidden="true">!</span>}
    <h2 id={titleId} tabIndex={-1}>{title}</h2>
    <p id={descriptionId} className="dialog-description">{description}</p>
    {children}
  </dialog>
}

export function SuccessMark() {
  return <span className="success-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m8 16 5.5 5.5L24 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
}
