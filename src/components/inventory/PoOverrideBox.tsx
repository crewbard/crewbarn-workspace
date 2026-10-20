/**
 * The PO-only override, inside any form that puts stock in: Add stock,
 * Receive stock, a new product's starting quantity, onboarding's starter
 * stock. It shows nothing when no override is needed.
 *
 * Blocked: says why, and where to go instead (receive it on a PO).
 * Reason only (count correction): a reason box.
 * Step-up: a reason box, then a 6-digit code by email or text that keeps
 * the override open for 30 minutes on this device.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import { useEndPoOverride, useSendPoOverrideCode, useVerifyPoOverrideCode, type PoOverrideGate } from '@/hooks/usePoOverride'

function message(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.'
}

function until(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function PoOverrideBox({ gate, what = 'this stock' }: { gate: PoOverrideGate; what?: string }) {
  const { need, reason, setReason, status } = gate
  const send = useSendPoOverrideCode()
  const verify = useVerifyPoOverrideCode()
  const end = useEndPoOverride()
  const [code, setCode] = useState('')

  if (need.kind === 'none') return null

  if (need.kind === 'blocked') {
    return (
      <div data-po-override="blocked" role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13.5px] text-amber-950">
        <p className="font-semibold">Your shop adds stock through purchase orders.</p>
        <p className="mt-0.5">Receive {what} on its purchase order. An owner or admin can let you override this in Staff › your profile.</p>
        <Link to="/purchase-orders" className="mt-2 inline-block font-semibold text-amber-800 underline">Open purchase orders</Link>
      </div>
    )
  }

  const short = reason.trim().length < need.min
  const reasonBox = (
    <label className="block">
      <span className="text-[13px] font-semibold text-slate-800">
        {need.kind === 'reason' ? 'Why is the count going up?' : 'Why is this coming in without a purchase order?'}
      </span>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
        aria-label="Override reason" data-po-override-reason
        placeholder={need.kind === 'reason' ? 'e.g. Found 3 more in the back during the count' : 'e.g. Counter pickup at the supply house, no PO'}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
      <span className={`text-[12.5px] ${short && reason ? 'text-rose-700' : 'text-slate-600'}`}>
        At least {need.min} characters. {need.kind === 'reason' ? 'Count corrections are logged.' : 'Every override is logged with your name.'}
      </span>
    </label>
  )

  if (need.kind === 'reason') {
    return <div data-po-override="reason" className="rounded-lg border border-slate-300 bg-slate-50 p-3">{reasonBox}</div>
  }

  const ch = status?.channels ?? { sms: false, email: false }
  const sent = send.data
  return (
    <div data-po-override="step-up" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
      <p className="text-[13.5px] font-semibold text-amber-950">Override: adding stock without a purchase order</p>
      {reasonBox}
      {need.live && status?.session ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-emerald-900">
          <span className="rounded bg-emerald-100 px-2 py-1 font-semibold">Confirmed until {until(status.session.expires_at)}</span>
          <button type="button" onClick={() => end.mutate()} disabled={end.isPending} className="font-semibold text-slate-700 underline">End it now</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] text-slate-800">Confirm it is you. We send a 6-digit code; it keeps the override open for {status?.session_minutes ?? 30} minutes on this device.</p>
          {!ch.sms && !ch.email ? (
            <p className="text-[13px] text-rose-800">There is no email or phone on your profile that can get a code. <Link to="/me" className="font-semibold underline">Add one on your profile</Link>.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ch.email && (
                <button type="button" onClick={() => send.mutate('email')} disabled={send.isPending}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
                  {sent ? 'Send a new code by email' : 'Email me a code'}
                </button>
              )}
              {ch.sms && (
                <button type="button" onClick={() => send.mutate('sms')} disabled={send.isPending}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
                  {sent ? 'Text a new code' : 'Text me a code'}
                </button>
              )}
            </div>
          )}
          {sent && <p className="text-[13px] text-slate-700">Sent to {sent.to}. It works for {sent.expires_in_minutes} minutes.</p>}
          {send.error && <p role="alert" className="text-[13px] text-rose-800">{message(send.error)}</p>}
          {sent && (
            <div className="flex flex-wrap items-center gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                aria-label="6-digit code" placeholder="6-digit code"
                className="h-10 w-36 rounded-lg border border-slate-300 px-3 text-center font-mono text-[15px] tracking-[0.2em] focus:border-amber-500 focus:outline-none" />
              <button type="button" onClick={() => verify.mutate(code)} disabled={code.length !== 6 || verify.isPending}
                className="h-10 rounded-lg bg-amber-500 px-4 text-[13px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60">Confirm</button>
              {code.length !== 6 && <span className="text-[12.5px] text-slate-600">Type all 6 digits.</span>}
            </div>
          )}
          {verify.error && <p role="alert" className="text-[13px] text-rose-800">{message(verify.error)}</p>}
        </div>
      )}
    </div>
  )
}
