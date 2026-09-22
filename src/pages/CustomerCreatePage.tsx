import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CustomerForm } from '@/components/CustomerForm'
import { useCreateCustomer } from '@/hooks/useCustomers'
import { ApiError } from '@/lib/api'
import type { CustomerInput } from '@/types/customer'

export function CustomerCreatePage() {
  const navigate = useNavigate()
  const createCustomer = useCreateCustomer()
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>()

  const handleSubmit = async (input: CustomerInput) => {
    setServerErrors(undefined)
    try {
      await createCustomer.mutateAsync(input)
      navigate('/customers', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const details = error.details as { [field: string]: string[] } | undefined
        if (details) setServerErrors(details)
      } else {
        console.error('Create customer failed:', error)
        alert('Failed to create customer. Check the console for details.')
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Back to Customers
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">New Customer</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Add the customer, contacts, service locations, billing defaults, and notes in one record.
        </p>
      </div>

      <CustomerForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/customers')}
        submitLabel="Create customer"
        serverErrors={serverErrors}
      />
    </div>
  )
}
