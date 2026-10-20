import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerForm } from '@/components/CustomerForm'
import { useCreateCustomer } from '@/hooks/useCustomers'
import { ApiError } from '@/lib/api'
import type { CustomerInput } from '@/types/customer'
import { uploadCustomValues, type CustomValues } from '@/components/CustomFieldsSection'
import { useTheme } from '@/hooks/useTheme'

export function CustomerCreatePage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  // From the call card's Create customer: ?phone=….
  const [searchParams] = useSearchParams()
  const prefill = { phone: searchParams.get('phone') }
  const createCustomer = useCreateCustomer()
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>()

  const handleSubmit = async (input: CustomerInput, customValues: CustomValues) => {
    setServerErrors(undefined)
    try {
      const created = await createCustomer.mutateAsync(input)
      if (Object.keys(customValues).length > 0) {
        try {
          await uploadCustomValues('customer', created.id, customValues)
        } catch (fieldError) {
          alert(`The customer was saved, but the custom fields were not: ${fieldError instanceof Error ? fieldError.message : String(fieldError)}. Open the customer and use Edit Info to try again.`)
        }
      }
      navigate('/customers', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const details = error.details as { [field: string]: string[] } | undefined
        if (details) setServerErrors(details)
      } else {
        console.error('Create customer failed:', error)
        alert(`Could not create the customer. ${error instanceof Error ? error.message : 'Please try again.'}`)
      }
    }
  }

  return (
    <div data-focus-page={theme === 'focus' ? 'customer-create' : undefined} className={`mx-auto w-full px-3 py-4 sm:px-6 sm:py-6 ${theme === 'focus' ? 'max-w-[1760px]' : 'max-w-[1440px]'}`}>
      <div className="mb-4 sm:mb-6" data-tour="customer-new-header">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Back to Customers
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">New Customer</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {theme === 'focus'
            ? 'Add the account, contacts, locations, billing defaults, and notes in short sections. Review everything before creating it.'
            : 'Add the account, contacts, service locations, billing defaults, and notes.'}
        </p>
      </div>

      <CustomerForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/customers')}
        submitLabel="Create customer"
        prefill={prefill}
        serverErrors={serverErrors}
      />
    </div>
  )
}
