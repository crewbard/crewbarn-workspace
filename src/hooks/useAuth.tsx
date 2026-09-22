import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '@/lib/auth'
import { getCurrentAccount, login as apiLogin, logout as apiLogout } from '@/lib/auth'
import { setActingTenant, setFranchiseActAs } from '@/lib/api'
import { getStoredToken, clearStoredToken } from '@/lib/api'

interface AuthContextValue {
  account: Account | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (
    email: string,
    password: string,
    deviceName: string,
    twoFactorCode?: string,
    trustDevice?: boolean,
    loginApprovalId?: string,
  ) => Promise<{
    twoFactorRequired: boolean
    method?: string
    fallbackMethod?: string
    loginApprovalId?: string | null
  }>
  logout: () => Promise<void>
  /** Re-fetch /auth/me and update context — e.g. after changing the profile photo. */
  refreshAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [account, setAccount] = useState<Account | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On boot, if a token exists, try to restore the session
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    getCurrentAccount()
      .then((account) => {
        setAccount(account)
      })
      .catch(() => {
        // Token invalid or expired - clear it
        clearStoredToken()
        setAccount(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (
    email: string,
    password: string,
    deviceName: string,
    twoFactorCode?: string,
    trustDevice?: boolean,
    loginApprovalId?: string,
  ): Promise<{
    twoFactorRequired: boolean
    method?: string
    fallbackMethod?: string
    loginApprovalId?: string | null
  }> => {
    const result = await apiLogin(
      email,
      password,
      deviceName,
      twoFactorCode,
      trustDevice,
      loginApprovalId,
    )
    if ('twoFactorRequired' in result) {
      return {
        twoFactorRequired: true,
        method: result.method,
        fallbackMethod: result.fallbackMethod,
        loginApprovalId: result.loginApprovalId,
      }
    }
    // A stale acting-tenant from a previous cross-tenant login on this
    // browser must not ride along: a role without tenant_data.access is
    // refused with that header on every request, and a role with it should
    // start in the console, not silently inside someone's shop.
    setActingTenant(null)
    setFranchiseActAs(null)
    setAccount(result.account)
    return { twoFactorRequired: false }
  }

  const logout = async () => {
    try {
      await apiLogout()
    } finally {
      setActingTenant(null)
      setFranchiseActAs(null)
      setAccount(null)
    }
  }

  const refreshAccount = async () => {
    try {
      setAccount(await getCurrentAccount())
    } catch {
      // Keep the current account — a failed refresh shouldn't log anyone out.
    }
  }

  const value: AuthContextValue = {
    account,
    isLoading,
    isAuthenticated: account !== null,
    login,
    logout,
    refreshAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
