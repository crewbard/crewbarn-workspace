import { useState } from 'react'
import { calibratedLength, pitchMm, type Point } from '@/lib/photoMeasurement'

/** Human-calibrated measurement aid; never a visual thread-size classifier. */
export function PhotoMeasure({ url, onUse }: { url: string; onUse: (text: string) => void }) {
  const [points, setPoints] = useState<Point[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [reference, setReference] = useState('')
  const [unit, setUnit] = useState<'mm' | 'in'>('mm')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [diameter, setDiameter] = useState('')
  const [pitch, setPitch] = useState('')
  const [pitchUnit, setPitchUnit] = useState<'mm' | 'tpi'>('tpi')
  const [confirmed, setConfirmed] = useState(false)
  const [label, setLabel] = useState('Length')
  const length = ready ? calibratedLength(points, Number(reference) * (unit === 'in' ? 25.4 : 1)) : null
  const diameterMm = Number(diameter) * (unit === 'in' ? 25.4 : 1)
  const pitchValue = pitchMm(Number(pitch), pitchUnit)
  const validManual = confirmed && Number.isFinite(diameterMm) && diameterMm > 0 && pitchValue !== null
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm'
  return <details className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
    <summary className="cursor-pointer text-sm font-bold text-amber-900">Measure & identify · inch / metric</summary>
    <p className="mt-3 text-sm text-slate-700">Near or far photos need their own calibration. Put a ruler beside the part at the same depth, with the camera straight-on. Different depths, wide-angle distortion, blur or tilted views can make this estimate wrong. Retake unsuitable photos; this tool does not automatically correct perspective or detect blur.</p>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-sm">Reading units<select className={inputClass} value={unit} onChange={e => { setUnit(e.target.value as 'mm' | 'in'); setReference(''); setDiameter(''); setConfirmed(false) }}><option value="mm">Millimeters</option><option value="in">Inches (decimal)</option></select></label>
      <label className="text-sm">Known ruler span<input className={inputClass} type="number" min="0.001" step="any" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. 25.4 mm or 1 inch" /></label>
    </div>
    <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={ready} onChange={e => setReady(e.target.checked)} />I can see clear endpoints, and the ruler and measured surface are in the same plane, viewed straight-on.</label>
    <p aria-live="polite" className="my-3 text-sm font-semibold">{points.length < 2 ? `Mark ruler endpoint ${points.length + 1} of 2` : points.length < 4 ? `Mark part endpoint ${points.length - 1} of 2` : 'Four points marked. Review the lines before using the estimate.'}</p>
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <div className="relative min-w-[600px]">
        <img src={url} alt="Measurement reference. Click two ruler endpoints, then two part endpoints." className="block h-auto w-full cursor-crosshair" onLoad={e => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onError={() => setFailed(true)} onClick={e => { if (points.length >= 4 || failed) return; const rect = e.currentTarget.getBoundingClientRect(); setPoints([...points, { x: (e.clientX - rect.left) / rect.width * size.width, y: (e.clientY - rect.top) / rect.height * size.height }]) }} />
        {size.width > 0 && <svg aria-hidden="true" viewBox={`0 0 ${size.width} ${size.height}`} className="pointer-events-none absolute inset-0 h-full w-full">{points.map((point, i) => <g key={i}><circle cx={point.x} cy={point.y} r={size.width / 100} fill={i < 2 ? '#d97706' : '#0284c7'} /><text x={point.x + size.width / 80} y={point.y} fontSize={size.width / 35} fill="#0f172a" stroke="white" strokeWidth={size.width / 1500} paintOrder="stroke">{i + 1}</text></g>)}{[0, 2].map(i => points[i + 1] && <line key={i} x1={points[i].x} y1={points[i].y} x2={points[i + 1].x} y2={points[i + 1].y} stroke={i === 0 ? '#d97706' : '#0284c7'} strokeWidth={size.width / 400} />)}</svg>}
      </div>
    </div>
    {failed && <p role="alert">This attachment cannot be measured as an image.</p>}
    <div className="mt-2 flex gap-4 text-sm"><button type="button" onClick={() => setPoints(points.slice(0, -1))}>Undo point</button><button type="button" onClick={() => setPoints([])}>Reset points</button></div>
    <label className="mt-3 block text-sm">What did you measure?<select className={inputClass} value={label} onChange={e => setLabel(e.target.value)}><option>Length</option><option>Outside diameter</option><option>Width</option><option>Ruler span across multiple thread intervals</option></select></label>
    {length !== null && !failed ? <div className="mt-3 rounded-lg bg-white p-3"><p className="text-sm font-bold">Photo estimate: {length.toFixed(2)} mm / {(length / 25.4).toFixed(3)} in</p><p className="mt-1 text-xs">Display precision is not accuracy. Confirm with a physical measuring tool before selecting a fastener.</p><button type="button" className="mt-2 text-sm font-semibold text-amber-900" onClick={() => onUse(`${label} — photo estimate: ${length.toFixed(2)} mm (${(length / 25.4).toFixed(3)} in). Reference: ${reference} ${unit}. User reports a clear, straight-on, same-plane view. Not physically verified.`)}>Add estimate to identification</button></div> : <p className="mt-3 text-xs text-slate-600">Select four well-separated points, enter a positive reference span and confirm photo suitability. Small spans need a closer photo.</p>}
    <div className="mt-4 border-t border-amber-200 pt-3">
      <h4 className="text-sm font-bold">Physical diameter and thread-gauge readings</h4>
      <p className="mt-1 text-xs">Enter outside diameter and pitch independently. This does not certify thread form, tolerance or compatibility. No automatic nominal-size match.</p>
      <label className="mt-2 block text-sm">Outside diameter ({unit})<input className={inputClass} type="number" min="0.001" step="any" value={diameter} onChange={e => { setDiameter(e.target.value); setConfirmed(false) }} /></label>
      <div className="mt-2 grid grid-cols-2 gap-3"><label className="text-sm">Pitch reading<input className={inputClass} type="number" min="0.001" step="any" value={pitch} onChange={e => { setPitch(e.target.value); setConfirmed(false) }} /></label><label className="text-sm">Pitch units<select className={inputClass} value={pitchUnit} onChange={e => { setPitchUnit(e.target.value as 'mm' | 'tpi'); setPitch(''); setConfirmed(false) }}><option value="tpi">Threads per inch</option><option value="mm">mm per thread</option></select></label></div>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked these readings with a caliper and thread gauge.</label>
      <button type="button" disabled={!validManual} className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold disabled:opacity-40" onClick={() => { if (validManual && pitchValue) onUse(`Human-reported caliper/thread-gauge readings: outside diameter ${diameterMm.toFixed(3)} mm (${(diameterMm / 25.4).toFixed(4)} in); pitch ${pitchValue.toFixed(4)} mm (${(25.4 / pitchValue).toFixed(3)} TPI). Nominal thread size and compatibility not automatically identified.`) }}>Add physical readings to identification</button>
    </div>
    <p className="mt-3 text-xs text-slate-500">Adding readings edits the identification draft below. Nothing is saved or taught until you press Save.</p>
  </details>
}
