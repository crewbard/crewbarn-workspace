import { lazy, Suspense } from 'react'
import type { MagazineViewerProps } from './MagazineViewer'

/*
 * Loaded when somebody opens a file and not before: the viewer brings
 * pdf.js with it, which is a megabyte nobody reading a job needs.
 */
const MagazineViewer = lazy(() => import('./MagazineViewer'))

export function OpenDocument(props: MagazineViewerProps) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#22262d]" aria-busy="true" />}>
      <MagazineViewer {...props} />
    </Suspense>
  )
}
