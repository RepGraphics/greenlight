import React, {useEffect, useState} from 'react'

import { useAuth } from '../contexts/AuthContext'
import AuthHome from './auth/home'
import AuthLoading from './auth/loading'
import AccountPicker from '../components/accountpicker'

export default function App({ children }: { children: React.ReactNode }) {
  const {isAuthenticated, isAuthenticating, desktop, savedAccounts} = useAuth()
  const [adding, setAdding] = useState(false)
  useEffect(() => {if (isAuthenticated) setAdding(false)}, [isAuthenticated])
  if (isAuthenticated) return <>{children}</>
  if (isAuthenticating) return <AuthLoading/>
  const hasAccounts = desktop && savedAccounts.length > 0
  if (hasAccounts && !adding) return <AccountPicker onAdd={() => setAdding(true)}/>
  return <AuthHome onBack={hasAccounts ? () => setAdding(false) : undefined}/>
}
