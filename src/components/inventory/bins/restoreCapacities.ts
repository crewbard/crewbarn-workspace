import { updateInventoryBin } from '@/lib/inventoryBins'

/** Put capacities back the way they were (the Undo on the toast). */
export async function restoreCapacities(before: Record<string, number | null>): Promise<void> {
  for (const [id, capacity] of Object.entries(before)) {
    await updateInventoryBin(id, { capacity })
  }
}
