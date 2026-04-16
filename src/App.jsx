import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Navbar from './components/Navbar'
import Budget from './pages/Budget'
import Transactions from './pages/Transactions'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">กำลังโหลด...</p>
    </div>
  )

  if (!session) return <Login />

return (
    <div className="min-h-screen bg-gray-50">
      <Navbar session={session} page={page} setPage={setPage} />
      {page === 'dashboard' && <Dashboard session={session} />}
      {page === 'budget' && <Budget session={session} />}
      {page === 'transactions' && <Transactions session={session} />}
    </div>
  )
}

export default App