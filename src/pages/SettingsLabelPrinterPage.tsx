import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { LabelPrinterSetup } from '@/components/labels/LabelPrinterSetup'
import { bridgeToken, checkBridge, PRINTER_LANGUAGE_NAMES, type BridgeCheck, type PrinterLanguage } from '@/lib/printBridge'
import {
  bluetoothLanguageChoice,
  bluetoothLanguageFor,
  lastBluetoothPrinterName,
  setBluetoothLanguage,
} from '@/lib/bluetoothPrint'
import { isWebBluetoothSupported } from '@/lib/escposBluetooth'

/**
 * Where a shop connects a printer to CrewBarn.
 *
 * This is the screen the Print Bridge's own window tells people to open,
 * so the wording matches what it says, in the same order.
 *
 * It is entirely optional and says so. A shop that never installs the
 * bridge keeps the Windows print dialog it has always had; what the bridge
 * adds is choosing WHICH printer, which no browser can do, and sending the
 * printer its own language so nothing scales a 2x1 label to fit a sheet of
 * Letter on the way.
 *
 * Settings are per computer, not per login: a printer is a physical object
 * on one desk, and the same account on a laptop at home has no label
 * printer attached to it.
 *
 * The Print Bridge part is LabelPrinterSetup, the same panel the Print
 * labels screen shows, so a shop can set up from either place and both
 * always agree.
 */
export function SettingsLabelPrinterPage() {
  const [check, setCheck] = useState<BridgeCheck>(() => ({
    running: null,
    paired: bridgeToken() !== '',
    printers: null,
    capabilities: [],
    version: '',
  }))
  const [btLanguage, setBtLanguage] = useState<PrinterLanguage | 'auto'>(bluetoothLanguageChoice())

  useEffect(() => {
    let alive = true
    void checkBridge().then((c) => {
      if (alive) setCheck(c)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div data-tour="lp-header">
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500">
        <Link to="/tool-shed" className="hover:underline">Tool Shed</Link>
        <span aria-hidden className="px-1.5 text-slate-300">/</span>
        <span className="font-semibold text-navy-900">Label printer</span>
      </nav>

      <h1 className="mt-2 text-2xl font-bold text-navy-900">Label printer</h1>
      <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
        Print labels straight to a printer on this computer, without the Windows print window and without it
        resizing anything. Optional — without it, printing still works the way it always has.
      </p>
      </div>

      <LabelPrinterSetup variant="page" check={check} onCheck={setCheck} />

      {isWebBluetoothSupported() && (
        <section data-tour="lp-bluetooth" className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-navy-900">Bluetooth label printer</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            The <b>Bluetooth printer</b> button on a Print labels screen sends to a printer paired with this browser,
            no Print Bridge needed. It is set separately, because it is usually a different printer.
          </p>
          <label className="mt-3 block">
            <span className="text-[13px] font-bold text-navy-900">What it speaks</span>
            <select
              value={btLanguage}
              onChange={(e) => {
                const next = e.target.value as PrinterLanguage | 'auto'
                setBluetoothLanguage(next)
                setBtLanguage(next)
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="auto">
                Work it out from the printer&apos;s name
                {lastBluetoothPrinterName()
                  ? ` — ${PRINTER_LANGUAGE_NAMES[bluetoothLanguageFor(lastBluetoothPrinterName(), 'auto')]} for ${lastBluetoothPrinterName()}`
                  : ''}
              </option>
              <option value="tspl">TSPL — most Bluetooth shipping and 2-inch label printers</option>
              <option value="escpos">ESC/POS — small receipt-style printers</option>
              <option value="zpl">ZPL — Zebra</option>
              <option value="epl">EPL — older Zebras</option>
            </select>
            <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
              If the printer&apos;s light blinks and nothing comes out, try TSPL here.
            </span>
          </label>
        </section>
      )}
    </div>
  )
}
