import { createPortal } from 'react-dom'
import { Modal } from '@/components/ui/Modal'
import { ANDROID_APP_QR, ANDROID_APP_URL } from '@/lib/androidApp'

/**
 * Account menu → Phone app: the CrewBarn phone app's QR code and link, so
 * anyone signed in on a computer can put the app on their phone with one
 * scan. The link and QR live in lib/androidApp.ts, with the beta intro's.
 */
export function PhoneAppModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <Modal isOpen onClose={onClose} size="sm" title="CrewBarn on your phone" subtitle="Jobs, photos, checklists and signatures, wherever the work is.">
      <Modal.Body>
        <div className="flex flex-col items-center gap-4 text-center">
          <a
            href={ANDROID_APP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the CrewBarn Android app download"
            className="block w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            {/* Dark on white whatever the theme: phone cameras read it best. */}
            <svg viewBox={`0 0 ${ANDROID_APP_QR.size} ${ANDROID_APP_QR.size}`} shapeRendering="crispEdges" className="block h-auto w-full" role="img" aria-label="QR code: install the CrewBarn Android app">
              <rect width={ANDROID_APP_QR.size} height={ANDROID_APP_QR.size} fill="#fff" />
              <path d={ANDROID_APP_QR.path} fill="#0f1a2e" />
            </svg>
          </a>
          <p className="text-sm text-slate-700">
            Point your Android phone's camera at the code, install the app, and sign in with your CrewBarn email and password.
          </p>
          <p className="text-xs text-slate-500">
            Android may ask you to allow installs from your browser the first time. On an iPhone, use CrewBarn in the browser until the App Store version is out.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <a
          href={ANDROID_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50"
        >
          Open the download page
        </a>
        <button type="button" onClick={onClose} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
          Done
        </button>
      </Modal.Footer>
    </Modal>,
    document.body,
  )
}
