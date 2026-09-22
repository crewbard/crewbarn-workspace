import { Link } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import { AiConnectorSettingsCard } from '@/components/settings/AiConnectorSettingsCard'

export function AiConnectorsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link to="/me/account" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <IconArrowLeft className="h-4 w-4" /> My account
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">AI connectors</h1>
      <AiConnectorSettingsCard />
    </div>
  )
}
