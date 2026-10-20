import { useEffect, useState, type ReactNode } from 'react'

import {
  bridgeHost,
  bridgeLanguageChoice,
  bridgePrinter,
  checkBridge,
  detectPrintMode,
  downloadBridgeBinary,
  guessPrinterLanguage,
  PRINT_MODE_NAMES,
  setBridgeLanguage,
  type BridgeCheck,
  type PrintMode,
} from '@/lib/printBridge'
import { printLabelThroughBridge, testLabelSize } from '@/lib/bridgeLabels'
import {
  bridgeOutdated,
  chooseHost,
  choosePrinter,
  cleanPairingCode,
  connectBridge,
  connectedBy,
  disconnectBridge,
  PAIRING_CODE,
  setupStage,
  testLabelMessage,
} from '@/lib/labelPrinterSetup'
import { rememberedThermalSize, THERMAL_SIZES } from '@/lib/thermalLabels'
import { apiRequest } from '@/lib/api'

export interface PrintBridgeDownload {
  available: boolean
  size: number | null
  arm_available: boolean
  /** Recorded when the build was published, so the page can show one. */
  sha256: string | null
  version: string | null
}

const NO_DOWNLOAD: PrintBridgeDownload = { available: false, size: null, arm_available: false, sha256: null, version: null }

export interface LabelPrinterSetupProps {
  /** What the bridge said last. The parent owns it, so its status light changes the moment this does. */
  check: BridgeCheck
  onCheck: (next: BridgeCheck) => void
  /**
   * 'page' is Settings › Label printer: each step in its own card, with the
   * page tour's anchors. 'panel' is the Print labels screen: the same steps,
   * compact, inside its printer section.
   */
  variant?: 'page' | 'panel'
  /** Only for tests: what the download check would have said. */
  initialDownload?: PrintBridgeDownload
}

/**
 * Everything it takes to connect this computer's label printer: download
 * the Print Bridge, type its code, pick the printer, say what it speaks,
 * and print a test label. One component, used on the Print labels screen
 * and on Settings › Label printer, so both always show the same thing.
 *
 * The chosen printer, address and language are read from this browser's
 * storage on every draw rather than copied into state, so there is only
 * ever one answer. After changing one, onCheck hands the parent a fresh
 * copy of the check, which redraws it and anything it shows (the light).
 */
export function LabelPrinterSetup({ check, onCheck, variant = 'page', initialDownload }: LabelPrinterSetupProps) {
  const page = variant === 'page'
  const stage = setupStage(check)
  const chosen = bridgePrinter()
  const host = bridgeHost()
  const language = bridgeLanguageChoice()
  const printers = check.printers ?? []
  const capabilities = check.capabilities
  const canImage = capabilities.includes('image')

  const [code, setCode] = useState('')
  const [hostDraft, setHostDraft] = useState(host)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [download, setDownload] = useState<PrintBridgeDownload>(initialDownload ?? NO_DOWNLOAD)
  const [grabbing, setGrabbing] = useState(false)
  const [grabError, setGrabError] = useState<string | null>(null)

  // Whether there is a build to hand out at all. Its absence is worth
  // saying plainly rather than offering a link that fails.
  useEffect(() => {
    if (initialDownload) return
    let alive = true
    void apiRequest<{ data: PrintBridgeDownload }>('/v1/print-bridge/status')
      .then((res) => {
        if (alive) setDownload(res.data)
      })
      .catch(() => {
        /* An older backend has no such endpoint. No download offered. */
      })
    return () => {
      alive = false
    }
  }, [initialDownload])

  const refresh = () => onCheck({ ...check })

  const grabBridge = async (arch: 'x64' | 'arm64') => {
    setGrabbing(true)
    setGrabError(null)
    try {
      await downloadBridgeBinary(arch)
    } catch (e) {
      setGrabError(e instanceof Error ? e.message : String(e))
    } finally {
      setGrabbing(false)
    }
  }

  const lookAgain = async () => {
    setError(null)
    onCheck({ ...check, running: null })
    onCheck(await checkBridge())
  }

  const connect = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const next = await connectBridge(code)
      setCode('')
      onCheck(next)
      setNote(
        next.printers && next.printers.length > 0
          ? 'Connected. This computer can now print straight to the printer below.'
          : 'Connected, but the Print Bridge found no printers. Check the label printer is on and plugged in, then press Look for printers again.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const chosenInfo = printers.find((p) => p.name === chosen) ?? null
  const detected: PrintMode = host
    ? guessPrinterLanguage(host)
    : chosenInfo
      ? detectPrintMode(chosenInfo, capabilities)
      : guessPrinterLanguage(chosen)
  const effective: PrintMode = language === 'auto' ? detected : language
  const testSize = testLabelSize(rememberedThermalSize())
  const testSpec = THERMAL_SIZES[testSize]

  const testPrint = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const result = await printLabelThroughBridge(
        {
          qrValue: 'crewbarn:test',
          title: 'Test label',
          code: new Date().toLocaleTimeString(),
          tag: 'TEST',
          path: 'If you can read this, it works',
        },
        testSize,
        { jobName: 'CrewBarn test label', printer: chosenInfo, capabilities, mode: effective },
      )
      setNote(testLabelMessage(result, testSpec))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveHost = () => {
    if (!chooseHost(hostDraft)) {
      setError('That is not a network address. Type it like 192.168.1.40.')
      return
    }
    setError(null)
    setHostDraft(hostDraft.trim())
    refresh()
  }

  const tour = (id: string) => (page ? `lp-${id}` : undefined)
  const text = page ? 'text-[13px]' : 'text-[12px]'
  const primary = `rounded-lg bg-amber-500 font-bold text-white hover:bg-amber-600 disabled:opacity-50 ${page ? 'px-4 py-2.5 text-sm' : 'px-3 py-2 text-[13px]'}`
  const secondary = `rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 ${page ? 'px-4 py-2.5 text-sm' : 'px-3 py-2 text-[13px]'}`
  const field = `mt-1 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-amber-500 focus:outline-none ${page ? 'py-2.5' : 'py-2'}`

  /*
   * A card on the settings page, a plain block in the panel. Called as a
   * function, not used as <Block>: a component made inside this one would be
   * a new component every draw, and the code box would lose its typing.
   */
  const block = (id: string, title: string, children: ReactNode) =>
    page ? (
      <section data-tour={tour(id)} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-navy-900">{title}</h2>
        {children}
      </section>
    ) : (
      <div data-setup={id} className="mt-2">
        <h3 className="text-[13px] font-bold text-navy-900">{title}</h3>
        {children}
      </div>
    )

  const downloadButtons = (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {download.available ? (
          <button type="button" onClick={() => void grabBridge('x64')} disabled={grabbing} className={primary}>
            {grabbing
              ? 'Downloading…'
              : `Download the Print Bridge${download.size ? ` (${Math.round(download.size / 1024 / 1024)} MB)` : ''}`}
          </button>
        ) : (
          <span className={`rounded-lg bg-slate-100 font-semibold text-slate-500 ${page ? 'px-4 py-2.5 text-sm' : 'px-3 py-2 text-[13px]'}`}>
            No build published yet
          </span>
        )}
        <button type="button" onClick={() => void lookAgain()} className={secondary}>
          I have started it — look again
        </button>
      </div>
      {grabError && <p className="mt-2 text-[13px] font-medium text-red-700">{grabError}</p>}
      {download.arm_available && (
        <p className="mt-2 text-[12px] text-slate-500">
          On a Windows ARM machine (a Surface Pro X and the like)?{' '}
          <button
            type="button"
            onClick={() => void grabBridge('arm64')}
            disabled={grabbing}
            className="font-semibold text-amber-700 underline disabled:opacity-60"
          >
            Download the ARM version
          </button>{' '}
          instead — the ordinary one will not start.
        </p>
      )}
    </>
  )

  return (
    <div data-tour={page ? undefined : 'labels-printer-setup'} data-stage={stage}>
      {error && (
        <p className={`${page ? 'mt-4' : 'mt-2'} rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 ${text} text-rose-700`}>
          {error}
        </p>
      )}
      {note && (
        <p className={`${page ? 'mt-4' : 'mt-2'} rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 ${text} text-emerald-800`}>
          {note}
        </p>
      )}

      {stage === 'looking' && (
        <p data-tour={tour('looking')} className={`${page ? 'mt-6 text-sm' : 'mt-2 text-[13px]'} text-slate-500`}>
          Looking for the Print Bridge…
        </p>
      )}

      {stage === 'not-running' && (
        block(
          'install',
          check.paired ? 'Start the Print Bridge on this computer' : 'The Print Bridge is not running on this computer',
          <>
            {check.paired ? (
              <p className={`mt-1 ${text} leading-relaxed text-slate-600`}>
                This computer is connected, but the Print Bridge isn&apos;t open. Start CrewBarn Print Bridge, then look
                again. Not installed any more? Download it again below.
              </p>
            ) : (
              <>
                <p className={`mt-1 ${text} leading-relaxed text-slate-600`}>
                  It is a small program that stays open in the background and lets CrewBarn send a label to a printer you
                  pick.{page ? ' Without it, labels go through the Windows print window, which is fine — you just choose the printer yourself each time and it decides how to size things.' : ' Without it, the Print button opens the print window.'}
                </p>
                <ol className={`mt-2 list-decimal space-y-1 pl-5 ${text} leading-relaxed text-slate-700`}>
                  <li>Download it below and put it somewhere permanent, like <code>C:\CrewBarn\</code> — not Downloads.</li>
                  <li>
                    Run it. Windows will warn you because it is not signed — <b>More info → Run anyway</b>.
                    {page && (
                      <>
                        {' '}It is built from CrewBarn&apos;s own source
                        {download.sha256 ? ', and the checksum below is there to check it against' : ''}.
                      </>
                    )}
                  </li>
                  <li>A small window opens with a code. Leave it open and come back here.</li>
                </ol>
              </>
            )}
            {downloadButtons}
            {page && download.sha256 && (
              <details className="mt-3 text-[12px] text-slate-500">
                <summary className="cursor-pointer font-semibold text-slate-600">
                  Check the download is the real thing
                  {download.version ? ` (version ${download.version})` : ''}
                </summary>
                <p className="mt-1.5 leading-relaxed">In PowerShell, in the folder you saved it to:</p>
                <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-700">
                  Get-FileHash .\crewbarn-print-bridge.exe
                </code>
                <p className="mt-1.5">It should print:</p>
                <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-700">
                  {download.sha256.toUpperCase()}
                </code>
              </details>
            )}
          </>,
        )
      )}

      {stage === 'needs-pairing' && (
        block(
          'pair',
          check.paired ? 'Connect this computer again' : 'Connect this computer',
          <>
            <p className={`mt-1 ${text} leading-relaxed text-slate-600`}>
              {check.paired
                ? 'The Print Bridge did not accept this computer any more. Type the six-digit code its window is showing now.'
                : 'The Print Bridge window is showing a six-digit code. Type it here. You only do this once on this computer.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(cleanPairingCode(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && PAIRING_CODE.test(code) && !busy) void connect()
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Pairing code"
                className={`rounded-lg border border-slate-300 px-3 text-center font-mono tracking-[0.3em] focus:border-amber-500 focus:outline-none ${page ? 'w-40 py-2.5 text-lg' : 'w-36 py-2 text-base'}`}
              />
              <button type="button" onClick={() => void connect()} disabled={!PAIRING_CODE.test(code) || busy} className={primary}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              Codes last ten minutes. If yours has expired, close the Print Bridge window and open it again for a new one.
            </p>
          </>,
        )
      )}

      {(stage === 'needs-printer' || stage === 'ready') && (
        <section
          data-tour={tour('connected')}
          className={page ? 'mt-6 rounded-xl border border-slate-200 bg-white p-5' : 'mt-1'}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {page ? (
                <>
                  <h2 className="text-sm font-bold text-navy-900">Connected</h2>
                  <p className="mt-1 text-[13px] text-slate-600">Labels from this computer go straight to the printer below.</p>
                </>
              ) : (
                <p className="text-[12px] text-slate-500">
                  Connected{check.version ? ` · Print Bridge ${check.version}` : ''}. Set once per computer.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Disconnect the Print Bridge on this computer? You will need a new pairing code to connect it again.')) return
                setNote(null)
                setHostDraft('')
                onCheck(disconnectBridge(check))
              }}
              className={`shrink-0 font-semibold text-slate-500 hover:text-rose-600 ${text}`}
            >
              Disconnect
            </button>
          </div>

          {bridgeOutdated(check) && (
            <p className={`mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 ${text} leading-relaxed text-amber-900`}>
              This computer has Print Bridge {check.version}. Version 2 adds DYMO and Brother printers, network printers by
              address, and tells CrewBarn what each printer is.{' '}
              {download.available && (
                <button
                  type="button"
                  onClick={() => void grabBridge('x64')}
                  disabled={grabbing}
                  className="font-semibold text-amber-800 underline disabled:opacity-60"
                >
                  Download the new one
                </button>
              )}
              {download.available ? ', close the old window and start the new one.' : ''}
            </p>
          )}
          {grabError && bridgeOutdated(check) && <p className="mt-2 text-[13px] font-medium text-red-700">{grabError}</p>}

          <label className={`${page ? 'mt-4' : 'mt-3'} block`} data-tour={tour('printer')} data-printers={printers.length > 0 ? 'found' : 'none'}>
            <span className="text-[13px] font-bold text-navy-900">Which printer</span>
            <select
              value={printers.some((p) => p.name === chosen) ? chosen : ''}
              onChange={(e) => {
                choosePrinter(e.target.value, printers)
                setNote(null)
                refresh()
              }}
              disabled={Boolean(host)}
              aria-label="Which printer"
              className={field}
            >
              {printers.length === 0 ? (
                <option value="">No printers found</option>
              ) : (
                !printers.some((p) => p.name === chosen) && (
                  <option value="">{chosen ? `${chosen} isn't here — pick a printer` : 'Pick your label printer…'}</option>
                )
              )}
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.is_default ? ' (Windows default)' : ''}
                </option>
              ))}
            </select>
            {host ? (
              <span className="mt-1 block text-[12px] text-slate-500">Not used while labels go to the network address below.</span>
            ) : (
              chosenInfo?.driver && (
                <span className="mt-1 block text-[12px] text-slate-500">
                  Driver: {chosenInfo.driver}
                  {connectedBy(chosenInfo) ? ` · Connected by ${connectedBy(chosenInfo)}` : ''}
                  {chosenInfo.offline ? ' · Windows says it is offline' : ''}
                </span>
              )
            )}
          </label>

          <details className={`mt-3 ${text}`} open={Boolean(host)}>
            <summary className="cursor-pointer font-semibold text-slate-600">A printer on the network that is not in this list</summary>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              Type the printer&apos;s address, like <code>192.168.1.40</code>. Labels go straight to it on port 9100.
              Only addresses on this building&apos;s network work. Pick its language below: an address does not say what
              the printer is.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={hostDraft}
                onChange={(e) => setHostDraft(e.target.value)}
                placeholder="192.168.1.40"
                aria-label="Printer network address"
                className="w-48 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
              <button type="button" onClick={saveHost} disabled={hostDraft.trim() === host} className={secondary}>
                Use this address
              </button>
              {host && (
                <button
                  type="button"
                  onClick={() => {
                    chooseHost('')
                    setHostDraft('')
                    refresh()
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-rose-600"
                >
                  Go back to the printer list
                </button>
              )}
            </div>
          </details>

          <label className={`${page ? 'mt-4' : 'mt-3'} block`} data-tour={tour('language')}>
            <span className="text-[13px] font-bold text-navy-900">What it speaks</span>
            <select
              value={language}
              onChange={(e) => {
                setBridgeLanguage(e.target.value as PrintMode | 'auto')
                refresh()
              }}
              aria-label="What it speaks"
              className={field}
            >
              <option value="auto">
                {chosenInfo?.driver && !host ? 'Work it out from the printer' : 'Work it out from the name'}
                {chosen || host ? ` — ${PRINT_MODE_NAMES[detected]}` : ''}
              </option>
              <option value="tspl">TSPL — Rollo, MUNBYN, iDPRT, TSC and most 4×6 shipping label printers</option>
              <option value="zpl">ZPL — Zebra</option>
              <option value="epl">EPL — older Zebras such as the LP 2844 and TLP 2844</option>
              <option value="escpos">ESC/POS — small receipt-style thermal printers</option>
              {(canImage || language === 'image') && (
                <option value="image">Printer driver — DYMO, Brother QL and any printer that needs its own driver</option>
              )}
            </select>
            <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
              Only worth touching if a test label does not come out. A printer sent the wrong language does nothing at all,
              which looks exactly like a cable that has fallen out.
            </span>
            {page && (
              <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
                {canImage
                  ? "Printer driver sends the label as a picture through the printer's own Windows driver, at the label's exact size. DYMO LabelWriter and Brother QL printers need this."
                  : "DYMO LabelWriter and Brother QL printers don't take any of these languages. Version 2 of the Print Bridge prints to them through their own driver; until then, use the Windows print window."}
              </span>
            )}
          </label>

          <div className={`${page ? 'mt-4' : 'mt-3'} flex flex-wrap gap-2`} data-tour={tour('test')}>
            <button type="button" onClick={() => void testPrint()} disabled={busy || stage !== 'ready'} className={primary}>
              {busy ? 'Sending…' : 'Print a test label'}
            </button>
            <button type="button" onClick={() => void lookAgain()} disabled={busy} className={secondary}>
              Look for printers again
            </button>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
            {page &&
              'The label is drawn once at the printer’s own resolution and sent at its real size, so a 2×1 comes out 2×1 whichever way it goes — nothing is scaled to fit a sheet of Letter on the way. '}
            The test label is {testSpec.w}&times;{testSpec.h}, the size last picked on a Print labels screen.
          </p>
        </section>
      )}
    </div>
  )
}
