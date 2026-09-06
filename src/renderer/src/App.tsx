import { Routes, Route, Navigate } from 'react-router-dom'
import { AppDataProvider } from './lib/store'
import { AppShell } from './components/AppShell'
import { Dashboard } from './routes/Dashboard'
import { AddApplication } from './routes/Add'
import { Detail } from './routes/Detail'
import { Settings } from './routes/Settings'

export function App() {
  return (
    <AppDataProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddApplication />} />
          <Route path="/app/:id" element={<Detail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AppDataProvider>
  )
}
