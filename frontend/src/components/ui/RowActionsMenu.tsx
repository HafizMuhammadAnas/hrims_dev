import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type RowActionsMenuProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  triggerLabel?: string
}

export function RowActionsMenu({
  isOpen,
  onOpenChange,
  children,
  triggerLabel = 'Action',
}: RowActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const [pos, setPos] = useState<{ top: number; left: number; minW: number } | null>(null)

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.right, minW: Math.max(r.width, 120) })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null)
      return
    }
    updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      if (anchorRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      onOpenChangeRef.current(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChangeRef.current(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <div className="row-actions-menu" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="row-actions-trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!isOpen)}
      >
        {triggerLabel}
      </button>
      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="row-actions-list row-actions-list--portal"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-100%)',
              zIndex: 12000,
              minWidth: pos.minW,
            }}
            role="menu"
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  )
}
