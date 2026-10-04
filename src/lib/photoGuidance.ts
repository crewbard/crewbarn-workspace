/** Copy hints only, never product identification or compatibility evidence. */
export function photoGuidance(subject = ''): string {
  const hints: Array<[RegExp, string]> = [
    [/\b(door|deadbolt|latch|hinge|strike)\b/i, 'Brand, latch or hinge markings, door thickness, dimensions, material, finish, or what needs repair…'],
    [/\b(hvac|furnace|compressor|air conditioner|thermostat)\b/i, 'Equipment brand, model/serial label, voltage, component markings, or the fault you are seeing…'],
    [/\b(pipe|faucet|valve|plumbing|drain)\b/i, 'Brand, pipe or fitting size, thread type, material, connection style, or where it leaks…'],
    [/\b(electrical|breaker|outlet|contactor|wiring)\b/i, 'Manufacturer, model, voltage/current rating, terminal markings, or the damaged component…'],
    [/\b(vehicle|automotive|vin|key fob|car key)\b/i, 'Year/make/model or VIN, component markings, and the part you need; for keys, add FCC ID and button layout…'],
    [/\b(wood|cabinet|drywall|flooring|lumber)\b/i, 'Material, dimensions, thickness, finish, damaged area, or the repair needed…'],
  ]
  const matches = hints.filter(([pattern]) => pattern.test(subject))
  return matches.length === 1 ? matches[0][1] : 'Describe the item or issue, brand/model, visible markings, dimensions, material, or what CBI got wrong…'
}
