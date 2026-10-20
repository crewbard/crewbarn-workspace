import type { FormEvent } from 'react'
import type { StaffSetupPreview } from '@/lib/staffSetup'
const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900'

export function StaffSetupForm({ data, busy, error, onSubmit }: { data: StaffSetupPreview; busy: boolean; error: string | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Contact information</legend>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">First name<input className={inputClass} name="first_name" defaultValue={data.first_name || ''} autoComplete="given-name" required maxLength={100} /></label><label className="text-sm">Last name<input className={inputClass} name="last_name" defaultValue={data.last_name || ''} autoComplete="family-name" maxLength={100} /></label></div>
          <p className="text-sm text-slate-600">Email: {data.email || 'Not provided'}</p><label className="block text-sm">Mobile number<input className={inputClass} name="phone" type="tel" defaultValue={data.phone || ''} autoComplete="tel" maxLength={40} /></label>
          <label className="block text-sm">Start date (optional)<input className={inputClass} name="start_date" type="date" /></label>
        </fieldset>
        {data.requires_password && <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Choose your password</legend><p className="text-sm text-slate-600">Use at least 8 characters.</p><label className="block text-sm">Password<input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label className="block text-sm">Confirm password<input className={inputClass} name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required /></label></fieldset>}
        {data.secure_vault_ready && <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Personal details (optional)</legend><p className="text-sm text-slate-600">These details are stored in your company’s secure files. You can leave them blank.</p>
          <label className="block text-sm">Date of birth<input className={inputClass} type="date" name="birthday" autoComplete="bday" /></label>
          <label className="block text-sm">Street address<input className={inputClass} name="address[street]" autoComplete="address-line1" maxLength={255} /></label><label className="block text-sm">Apartment or unit<input className={inputClass} name="address[apt_unit]" autoComplete="address-line2" maxLength={50} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">City<input className={inputClass} name="address[city]" autoComplete="address-level2" maxLength={100} /></label><label className="text-sm">State<input className={inputClass} name="address[state]" autoComplete="address-level1" maxLength={100} /></label></div><label className="block text-sm">ZIP or postal code<input className={inputClass} name="address[postal_code]" autoComplete="postal-code" maxLength={20} /></label>
          <label className="block text-sm">Social Security number<input className={inputClass} name="ssn" type="password" inputMode="numeric" autoComplete="off" maxLength={11} /></label>
          <label className="block text-sm">Emergency contact name<input className={inputClass} name="emergency_contact[name]" maxLength={120} /></label><label className="block text-sm">Emergency contact phone<input className={inputClass} name="emergency_contact[phone]" type="tel" maxLength={40} /></label>
          <label className="block text-sm">Driver’s license — front<input className={inputClass} name="dl_front" type="file" accept="image/*" /></label><label className="block text-sm">Driver’s license — back<input className={inputClass} name="dl_back" type="file" accept="image/*" /></label><p className="text-xs text-slate-500">Images up to 10 MB each.</p>
        </fieldset>}
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-amber-500 px-4 py-3 font-semibold text-slate-900 hover:bg-amber-600 disabled:opacity-60">{busy ? 'Saving…' : 'Finish setup'}</button>
      </form>
  )
}
