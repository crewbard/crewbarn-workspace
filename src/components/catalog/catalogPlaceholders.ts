import {
  IconAirConditioning,
  IconBattery2,
  IconBolt,
  IconCar,
  IconCpu,
  IconDeviceRemote,
  IconDoor,
  IconDroplet,
  IconFlame,
  IconKey,
  IconLock,
  IconPackage,
  IconTool,
  type Icon,
} from '@tabler/icons-react'

/**
 * Trade-neutral example text for catalog forms. CrewBarn serves every
 * trade, so examples mix trades rather than favouring one.
 */
export const PRODUCT_NAME_PLACEHOLDER = 'e.g. 1/2" brass ball valve'
export const PRODUCT_SHORT_DESC_PLACEHOLDER = 'e.g. "40-gallon gas water heater"'
export const PRODUCT_LONG_DESC_LABEL =
  'Long description (internal — searchable: model numbers, fitment, crossover part #s, alt names)'
export const PRODUCT_LONG_DESC_PLACEHOLDER =
  'e.g. "Model GS640 / fits 2019+ units / crossover part 12-345 / also called flush valve kit"'
export const SEARCH_ALIASES_PLACEHOLDER = 'e.g. "AC tune-up / AC tuneup / cooling check"'
export const CATEGORY_NAME_PLACEHOLDER = 'e.g. Repairs & Maintenance'
export const PRODUCT_CATEGORY_NAME_PLACEHOLDER = 'e.g. Parts & Supplies'

// ---------- Picture stand-ins ----------
// A product or category with no photo shows an icon for what it is instead of
// "No photo". One keyword table, checked in order, so "transponder key" is a
// key and "car remote" is a remote. Trade-neutral like the text above: keys and
// locks sit beside plumbing, electrical and HVAC.

const PRODUCT_ICONS: Array<[RegExp, Icon]> = [
  [/remote|fob|transmitter|clicker/i, IconDeviceRemote],
  [/\btools?\b|\bdrills?\b|\bpicks?\b|extractor|supplies/i, IconTool],
  [/key|blank|transponder/i, IconKey],
  [/lock|deadbolt|cylinder|padlock|lever|knob|strike|safe/i, IconLock],
  [/door|closer|hinge|exit device|panic/i, IconDoor],
  [/battery|cr20|aaa?\b/i, IconBattery2],
  [/auto|vehicle|car\b|truck/i, IconCar],
  [/chip|module|programm|electronic|sensor|board/i, IconCpu],
  [/electric|wire|breaker|outlet|switch|cable/i, IconBolt],
  [/plumb|valve|pipe|faucet|drain|water/i, IconDroplet],
  [/hvac|filter|coil|refrigerant|condens|thermostat|air/i, IconAirConditioning],
  [/gas|burner|furnace|heater|igniter/i, IconFlame],
]

/**
 * The icon for a product or category with no photo. The first name decides
 * when it matches (the product's own name), then the next (its category or
 * description), so "Tools & Supplies: ... programmers" stays a tool.
 */
export function productIconFor(...names: Array<string | null | undefined>): Icon {
  for (const name of names) {
    if (!name) continue
    for (const [re, icon] of PRODUCT_ICONS) if (re.test(name)) return icon
  }
  return IconPackage
}
