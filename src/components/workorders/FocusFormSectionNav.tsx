type Section = { label: string; tour: string }

/** A navigation aid for the Focus full-page form; it does not alter form state. */
export function FocusFormSectionNav({ kind }: { kind: 'job' | 'estimate' | 'sub' }) {
  const sections: Section[] = kind === 'sub'
    ? [
        { label: 'Customer', tour: 'sub-customer' },
        { label: 'Scope', tour: 'sub-basics' },
        { label: 'Files', tour: 'sub-files' },
        { label: 'Subcontractor', tour: 'sub-picker' },
        { label: 'Authorization', tour: 'sub-authorization' },
      ]
    : kind === 'estimate'
    ? [
        { label: 'Customer', tour: 'estimate-customer' },
        { label: 'Scope', tour: 'job-basics' },
        { label: 'Assets', tour: 'job-assets' },
        { label: 'Price & options', tour: 'estimate-lineitems' },
        { label: 'Schedule & crew', tour: 'job-schedule' },
        { label: 'Notes', tour: 'job-notes' },
      ]
    : [
        { label: 'Customer', tour: 'job-customer' },
        { label: 'Scope', tour: 'job-basics' },
        { label: 'Schedule & crew', tour: 'job-schedule' },
        { label: 'Line items', tour: 'job-lineitems' },
        { label: 'Assets', tour: 'job-assets' },
        { label: 'Notes', tour: 'job-notes' },
      ]

  return (
    <nav data-focus-form-nav data-tour="form-jump-to" aria-label={`${kind === 'sub' ? 'Sub job' : kind === 'job' ? 'Job' : 'Estimate'} form sections`}>
      <span>Jump to</span>
      {sections.map((section) => (
        <button
          key={section.tour}
          type="button"
          onClick={() => document.querySelector(`[data-tour="${section.tour}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {section.label}
        </button>
      ))}
    </nav>
  )
}
