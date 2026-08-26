import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.js'
import { useAuth } from './auth/useAuth.js'
import { HomePage } from './routes/HomePage.js'
import { LoginPage } from './routes/LoginPage.js'

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
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AuthProvider>
  )
}
