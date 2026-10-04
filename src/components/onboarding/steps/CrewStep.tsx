import { useEffect, useState } from 'react'
import { useInviteOnboardingStaff, useOnboardingStaff } from '@/hooks/useOnboarding'
import { usePermissions } from '@/hooks/usePermissions'
import type { InviteOnboardingStaffResponse } from '@/types/onboarding'
import { CopyValueBox, type StepProps } from '@/components/onboarding/steps/shared'

/**
 * Get your crew in.
 *
 * The rebuild is mostly about what happens AFTER the invite. The old screen
 * sent one and moved on; whether the email actually arrived was buried in a
 * sentence, and the fallback link sat in a box with no explanation of when to
 * use it. Email to a new address is exactly where this fails — a typo, a
 * spam filter, a shop with no email at all — so the result now says plainly
 * which of the two happened, and the link is offered as the thing to text
 * them rather than as a technical fallback.
 *
 * Roles are cards, not a dropdown: "what can this person see" is the part
 * people get wrong, and a dropdown hides every option but one.
 *
 * The invite payload and the skip are unchanged.
 */
export function CrewStep({ complete, onMarkStep, saving }: StepProps) {
  const staffQuery = useOnboardingStaff(true)
  const inviteStaff = useInviteOnboardingStaff()
  const { role_slug: actorRoleSlug } = usePermissions()

  const [staffFirstName, setStaffFirstName] = useState('')
  const [staffLastName, setStaffLastName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRoleSlug, setStaffRoleSlug] = useState('')
  const [staffError, setStaffError] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<InviteOnboardingStaffResponse | null>(null)

  // An owner can make another owner; nobody else can hand out their own job.
  const staffRoles = (staffQuery.data?.roles ?? []).filter(
    (role) => actorRoleSlug === 'owner' || role.role_slug !== 'owner',
  )
  const staffMembers = staffQuery.data?.data ?? []

  useEffect(() => {
    if (staffRoleSlug || staffRoles.length === 0) return
    setStaffRoleSlug(staffRoles[0].role_slug)
  }, [staffRoleSlug, staffRoles])

  function inviteCrewMember() {
    const firstName = staffFirstName.trim()
    const lastName = staffLastName.trim()
    const email = staffEmail.trim()

    const problem = !firstName
      ? 'What is their first name?'
      : !email || !email.includes('@')
        ? 'That email address does not look right — the invite is sent to it, so it has to be one they can open.'
        : !staffRoleSlug
          ? 'Pick what this person is allowed to see.'
          : null
    if (problem) {
      setStaffError(problem)
      return
    }

    setStaffError(null)
    setLastInvite(null)
    inviteStaff.mutate(
      { first_name: firstName, last_name: lastName || null, email, role_slug: staffRoleSlug },
      {
        onSuccess: (resp) => {
          setLastInvite(resp)
          setStaffFirstName('')
          setStaffLastName('')
          setStaffEmail('')
        },
        onError: (err) => setStaffError(err instanceof Error ? err.message : String(err)),
      },
    )
  }

  const busy = saving || inviteStaff.isPending

  return (
    <div className="space-y-5">
      {complete && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">Saved.</span> Add more people any time under Staff &amp; Crews.
        </p>
      )}

      <p className="text-[15px] leading-relaxed text-slate-600">
        Anyone who needs to sign in. They pick their own password from the invite — you never set one for them, and
        you never see it. Techs use the phone app with the same login.
      </p>

      {staffMembers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Already here · {staffMembers.length}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {staffMembers.map((member, i) => (
              <li key={i} className="text-sm text-slate-700">
                {[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-[15px] font-bold text-navy-900">Invite someone</h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="First name" value={staffFirstName} onChange={setStaffFirstName} placeholder="Dave" />
          <Field
            label="Last name"
            hint="Optional."
            value={staffLastName}
            onChange={setStaffLastName}
            placeholder="Hobbs"
          />
        </div>
        <div className="mt-4">
          <Field
            label="Their email"
            hint="Where the invite goes. It has to be one they can open — their own, not the office address."
            value={staffEmail}
            onChange={setStaffEmail}
            placeholder="dave@example.com"
            type="email"
          />
        </div>

        <h4 className="mt-6 text-sm font-bold text-navy-900">What they can see</h4>
        {staffRoles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Loading the roles…</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {staffRoles.map((role) => {
              const picked = staffRoleSlug === role.role_slug
              return (
                <button
                  key={role.role_slug}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => setStaffRoleSlug(role.role_slug)}
                  className={`flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition ${
                    picked ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      picked ? 'border-amber-500' : 'border-slate-300'
                    }`}
                  >
                    {picked && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-navy-900">{role.display_name}</span>
                    {role.description && (
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{role.description}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {staffError && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
            {staffError}
          </p>
        )}

        <button
          type="button"
          onClick={inviteCrewMember}
          disabled={busy}
          className="mt-5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {inviteStaff.isPending ? 'Sending…' : 'Send the invite'}
        </button>
      </section>

      {/*
        Whether the email actually went is the whole story here, and the two
        outcomes need different things from the reader: one is "tell them to
        check their inbox", the other is "text them this link". The old
        version put both in one sentence.
      */}
      {lastInvite && (
        <div
          className={`rounded-xl border p-4 ${
            lastInvite.invite.email_sent ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          {lastInvite.invite.email_sent ? (
            <>
              <p className="text-[15px] font-bold text-emerald-900">Invite sent</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Tell them to look for it — including in junk, the first one often lands there. The link below works
                too if it never turns up.
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-bold text-amber-900">Made, but the email did not send</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                Nothing is wrong with the invite — send them this link yourself and it works exactly the same.
                {lastInvite.invite.email_error ? ` (${lastInvite.invite.email_error})` : ''}
              </p>
            </>
          )}
          <div className="mt-3">
            <CopyValueBox label="Their setup link" value={lastInvite.invite.accept_url} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={() => onMarkStep({ choice: 'skip_staff_invite' })}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {staffMembers.length > 0 ? 'Done — carry on' : 'I will do this later'}
        </button>
        <span className="text-sm text-slate-500">You can invite the rest whenever you like.</span>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-navy-900">{label}</span>
      {hint && <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{hint}</span>}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  )
}
