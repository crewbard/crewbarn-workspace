import { createPortal } from 'react-dom'
import { IncomingCallToasts } from '@/components/IncomingCallToasts'
import { IntakeToasts } from '@/components/IntakeToasts'
import { MessageToasts } from '@/components/MessageToasts'
import { PaymentToasts } from '@/components/PaymentToasts'
import { ReviewToasts } from '@/components/ReviewToasts'
import { TwilioCallOverlay } from '@/components/comms/TwilioCallOverlay'
import { NotificationStack } from '@/components/NotificationStack'
import { onConnect } from '@/lib/workspaceScope'

// A viewport portal keeps alerts independent of navigation and shell layout.
export function ToastLayers() {
  /*
   * Not on Connect.
   *
   * Connect is the settings console — somebody is in there changing how
   * the company works, not watching the phones. A customer call popping
   * over a form is an interruption with nothing behind it: the thread it
   * wants to open, and the call-back it offers, both live in the
   * workspace, so acting on one means leaving the page mid-edit.
   *
   * A failed save still surfaces everywhere; MutationErrorToasts is
   * mounted separately for exactly that reason.
   */
  if (onConnect()) return null

  return createPortal(
    <>
      <NotificationStack>
        <MessageToasts />
        <IncomingCallToasts />
        <IntakeToasts />
        <PaymentToasts />
        <ReviewToasts />
      </NotificationStack>
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 w-[min(24rem,calc(100vw-2rem))] print:hidden">
        <TwilioCallOverlay />
      </div>
    </>,
    document.body,
  )
}
