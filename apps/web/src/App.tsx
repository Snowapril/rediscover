import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { useAuth } from './auth/useAuth.ts'
import { HomePage } from './routes/HomePage.tsx'
import { LoginPage } from './routes/LoginPage.tsx'

// Created once outside the component so a re-render never discards the cache.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

/*
 * @brief Send signed-out visitors to the sign in screen.
 * @details Renders nothing until the persisted session has been read, so a
 *   reload does not flash the sign in screen at an already signed-in user.
 */
function RequireSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session === null) return <Navigate to="/login" replace />
  return children
}

function Router() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : session !== null ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <RequireSession>
            <HomePage />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Router />
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  )
}
