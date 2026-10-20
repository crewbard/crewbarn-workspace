import { Navigate, useLocation } from 'react-router-dom'

/** Old /reports links keep their query: report links go to the browser, the rest to the question list. */
export function ReportsRedirect() {
  const { search } = useLocation()
  const target = /[?&]report=/.test(search) || /[?&]layout=browser/.test(search) ? '/accounting/reports/browse' : '/accounting/reports'
  return <Navigate to={`${target}${search}`} replace />
}
