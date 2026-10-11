import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ActionNotice } from '../components/ui/Alert'

/** React Router location.state key for one-shot success/info notices after navigation. */
export const ACTION_FLASH_STATE_KEY = 'hrimsActionFlash' as const

export type ActionFlashState = {
  [ACTION_FLASH_STATE_KEY]?: ActionNotice
}

export function actionFlashSuccess(title: string, message: string): ActionNotice {
  return { variant: 'success', title, message }
}

export function actionFlashInfo(title: string, message: string): ActionNotice {
  return { variant: 'info', title, message }
}

/** Build navigate() state that carries a one-shot ActionNotice. */
export function withActionFlash(
  notice: ActionNotice,
  existingState?: Record<string, unknown> | null,
): ActionFlashState {
  return { ...(existingState ?? {}), [ACTION_FLASH_STATE_KEY]: notice }
}

/**
 * Read a flash notice from location.state once, then clear it from history so
 * refresh / back does not re-show it.
 */
export function useActionFlashNotice(): {
  notice: ActionNotice | null
  dismiss: () => void
} {
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<ActionNotice | null>(null)

  useEffect(() => {
    const state = location.state as ActionFlashState | null
    const flash = state?.[ACTION_FLASH_STATE_KEY]
    if (!flash) return
    setNotice(flash)
    const rest = { ...(state ?? {}) }
    delete rest[ACTION_FLASH_STATE_KEY]
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: Object.keys(rest).length > 0 ? rest : null,
    })
    // location.key changes on each navigation that may carry a flash.
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigate])

  return {
    notice,
    dismiss: () => setNotice(null),
  }
}
