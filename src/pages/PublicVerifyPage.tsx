import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

/**
 * Public record verification — /verify/{recordId}, no login.
 *
 * The reason AHJs distrust digital tags is that a QR proves nothing: anyone
 * can print one at home pointing anywhere. This page exists to be reachable
 * WITHOUT the sticker — an inspector types a record number off a paper report
 * and checks it against the source. A code that only ever validates itself is
 * not verification.
 *
 * Deliberately answers four questions and stops: which asset, which company,
 * under what licence, signed when. It is not a way into the record.
 */

interface VerifyPayload {
  verified: true
  record_id: string
  signed_at: string | null
  result: string | null
  asset: { name: string; code: string | null; tenant_id: string } | null
  servicer: { name: string | null; license_number: string | null; phone: string | null }
}

const API =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.crewbarn.com'

export function PublicVerifyPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const [state, setState] = useState<'loading' | 'ok' | 'bad' | 'error'>('loading')
  const [data, setData] = useState<VerifyPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const res = await fetch(`${API}/v1/verify/${encodeURIComponent(recordId ?? '')}`)
        if (cancelled) return
        if (res.status === 404) {
          setState('bad')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const body = (await res.json()) as { data: VerifyPayload }
        if (cancelled) return
        setData(body.data)
        setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [recordId])

  const signed = data?.signed_at ? new Date(data.signed_at) : null

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex items-center gap-2.5">
          <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
            <path
              d="M14 27 V38 q0 8 8 8 h20"
              fill="none"
              stroke="#0F1A2E"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M51 27 L32 13 L13 27"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-lg font-extrabold text-slate-900">
            Crew<span className="text-amber-500">Barn</span>
          </span>
        </div>

        {state === 'loading' && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
            <p className="mt-3 text-sm text-slate-500">Checking this record…</p>
          </div>
        )}

        {state === 'bad' && (
          <div className="rounded-xl border border-rose-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-700">
                !
              </span>
              <div>
                <h1 className="text-lg font-bold text-slate-900">No matching record</h1>
                <p className="mt-0.5 text-sm text-slate-600">
                  Nothing on file matches record{' '}
                  <span className="font-mono">{recordId}</span>.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Check the number against the paperwork. If it was read off a tag or certificate and
              still doesn't match, treat that document as unverified and contact the company that
              issued it.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-lg font-bold text-slate-900">Couldn't check right now</h1>
            <p className="mt-1 text-sm text-slate-600">
              This is a problem reaching CrewBarn, not a verdict on the record. Try again in a
              moment.
            </p>
          </div>
        )}

        {state === 'ok' && data && (
          <>
            <div className="rounded-t-xl bg-emerald-700 p-6 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-emerald-100">
                Verified record
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">
                This inspection is on file
              </p>
              <p className="mt-1.5 text-sm text-emerald-100">
                Held by CrewBarn, not by the tag you scanned.
              </p>
            </div>

            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white">
              <Row label="Record" value={data.record_id} mono />
              <Row
                label="Signed"
                value={
                  signed
                    ? signed.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not recorded'
                }
              />
              {data.result && <Row label="Result" value={labelise(data.result)} />}
              {data.asset && <Row label="Asset" value={data.asset.name} />}
              {data.asset?.code && <Row label="Tag" value={data.asset.code} mono />}
              <Row label="Serviced by" value={data.servicer.name ?? 'Not published'} />
              <Row
                label="License"
                value={data.servicer.license_number ?? 'Not published'}
                mono={!!data.servicer.license_number}
              />
            </div>

            {data.asset && (
              <Link
                to={`/scan/${data.asset.tenant_id}/${data.asset.code ?? ''}`}
                className="mt-4 block rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold text-white"
              >
                Open the full asset record
              </Link>
            )}

            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
              Only finalised inspections appear here. A record that is still in progress will not
              verify.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-right text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function labelise(v: string): string {
  return v.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
