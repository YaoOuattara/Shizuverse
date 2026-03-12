'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ProviderAuthContextType {
  provider: null
  token: string | null
  isLoading: boolean
}

const ProviderAuthContext = createContext<ProviderAuthContextType>({
  provider: null,
  token: null,
  isLoading: false,
})

export function ProviderAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('provider_token')
    if (stored) setToken(stored)
  }, [])

  return (
    <ProviderAuthContext.Provider value={{ provider: null, token, isLoading }}>
      {children}
    </ProviderAuthContext.Provider>
  )
}

export const useProviderAuth = () => useContext(ProviderAuthContext)
