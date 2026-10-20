import type { ReactNode } from 'react'
import { appExtensions } from '@/lib/appExtensions'

/**
 * Wraps the whole app and mounts whatever the full app registered beside it.
 * In CrewBarn's own app that is the platform staff's verify-to-open-a-company
 * window (src/admin/components/StepUpModal.tsx); in a copy without it, this
 * renders the app and nothing else.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const Overlay = appExtensions().RootOverlay
  return (
    <>
      {children}
      {Overlay && <Overlay />}
    </>
  )
}
