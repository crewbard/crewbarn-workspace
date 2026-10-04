import { CONNECT_URL } from '@/lib/workspaceScope'

export function CloudflareOnboardingGuide() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold text-navy-900">Connect Cloudflare — your account, your domain, your files</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">One connection unlocks three setup paths. Choose what you need; connecting an account does not buy a domain, publish a website, or move existing files automatically.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {[
        ['Host your own dashboard', 'Let CrewBarn deploy the work dashboard into your Cloudflare Pages account at an address such as office.yourcompany.com. Your business data and sign-ins remain on CrewBarn.'],
        ['Store files and images in R2', 'Set up your own Cloudflare R2 bucket for photos, documents, and uploads. Cloudflare usage charges are separate from your CrewBarn subscription.'],
        ['Build your business website', 'Buy a domain in your Cloudflare account or use one you already own. Build your website with CrewBarn and connect the public address separately from your office dashboard.'],
      ].map(([title, description]) => <div key={title} className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold text-navy-900">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p></div>)}
    </div>
    <p className="mt-4 text-sm text-slate-600">Domain registration is a separate yearly purchase, not a fixed $10 CrewBarn fee. Check the selected domain’s purchase and renewal price at <a href="https://www.cloudflare.com/domains/" target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-800 underline">Cloudflare ↗</a>.</p>
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="font-semibold">Before you create the API token</h3>
      <p className="mt-2">The connection page opens Cloudflare with some permissions prefilled. Check all three rows; if any are missing, choose “Add more” and select them yourself:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Zone → DNS → Edit</li>
        <li>Account → Workers R2 Storage → Edit</li>
        <li><strong>Account → Cloudflare Pages → Edit — add this manually.</strong></li>
      </ul>
      <p className="mt-2">Follow the account and zone resource instructions on Connect Cloudflare, then choose Continue to summary → Create Token. Copy the token once and paste it only into the connection form—not into chat.</p>
    </div>
    <a href={`${CONNECT_URL}/tool-shed/cloudflare`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">Connect Cloudflare ↗</a>
    <p className="mt-2 text-xs text-slate-500">Opens in another tab so your onboarding choices stay here. Return after connecting to finish setup.</p>
  </section>
}
