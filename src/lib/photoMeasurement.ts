export type Point = { x: number; y: number }
export function calibratedLength(points: Point[], referenceMm: number): number | null {
  if (points.length !== 4 || !Number.isFinite(referenceMm) || referenceMm <= 0 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const reference = distance(points[0], points[1])
  const target = distance(points[2], points[3])
  // Tiny selections are too sensitive to endpoint placement.
  return reference >= 20 && target >= 10 ? referenceMm * target / reference : null
}
export function pitchMm(value: number, unit: 'mm' | 'tpi'): number | null {
  return Number.isFinite(value) && value > 0 ? unit === 'tpi' ? 25.4 / value : value : null
}
