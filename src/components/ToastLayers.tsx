import { createPortal } from 'react-dom'
import { IncomingCallToasts } from '@/components/IncomingCallToasts'
import { IntakeToasts } from '@/components/IntakeToasts'
import { MessageToasts } from '@/components/MessageToasts'
import { TwilioCallOverlay } from '@/components/comms/TwilioCallOverlay'
import { NotificationStack } from '@/components/NotificationStack'

// A viewport portal keeps alerts independent of navigation and shell layout.
export function ToastLayers() {
  return createPortal(
    <>
      <NotificationStack>
        <MessageToasts />
        <IncomingCallToasts />
        <IntakeToasts />
      </NotificationStack>
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 w-[min(24rem,calc(100vw-2rem))] print:hidden">
        <TwilioCallOverlay />
      </div>
    </>,
    document.body,
  )
}
