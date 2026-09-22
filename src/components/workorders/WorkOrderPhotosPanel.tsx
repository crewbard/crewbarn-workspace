import { BarnCamPanel } from '@/components/BarnCamPanel'

/**
 * BarnCam panel for a work order. Thin wrapper over the shared
 * {@link BarnCamPanel} (the same gallery is reused on estimates).
 * Keeps its original export name + props so existing imports don't break.
 */
export function WorkOrderPhotosPanel({ workOrderId }: { workOrderId: string }) {
  return (
    <BarnCamPanel
      basePath={`/v1/work-orders/${workOrderId}`}
      cacheKey={['wo-attachments', workOrderId]}
    />
  )
}
