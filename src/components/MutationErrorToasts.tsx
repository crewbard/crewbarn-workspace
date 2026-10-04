import { useEffect, useState } from 'react'
import { NotificationStack } from '@/components/NotificationStack'
import { NotificationCard } from '@/components/NotificationCard'
import {
  dismissMutationError,
  subscribeMutationErrors,
  type MutationErrorNotice,
} from '@/lib/mutationErrorBus'

/**
 * Shows write failures that nothing else caught. See mutationErrorBus for why.
 *
 * Deliberately plain and deliberately sticky: no auto-dismiss, because the
 * whole failure mode being fixed is "it looked like nothing happened", and a
 * banner that vanishes after four seconds recreates it for anyone who glanced
 * away. The user closes it when they've read it.
 */
export function MutationErrorToasts() {
  const [notices, setNotices] = useState<MutationErrorNotice[]>([])

  useEffect(() => subscribeMutationErrors(setNotices), [])

  if (notices.length === 0) return null

  return (
    <NotificationStack>
      {notices.map(n => (
        <NotificationCard key={n.id} kind="Not saved" customer="Action needs attention"
          subtitle="Nothing was lost" description={n.message} type="error" urgent
          onDismiss={() => dismissMutationError(n.id)} />
      ))}
    </NotificationStack>
  )
}
