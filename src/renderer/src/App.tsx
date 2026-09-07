import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AppDataProvider } from './lib/store'
import { ViewProvider } from './lib/view'
import { AppShell } from './components/AppShell'
import { CommandPalette } from './components/CommandPalette'
import { Dashboard } from './routes/Dashboard'
import { AddApplication } from './routes/Add'
import { Detail } from './routes/Detail'
import { Settings } from './routes/Settings'

export function App() {
  const location = useLocation()
  return (
    <AppDataProvider>
      <ViewProvider>
      <AppShell>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="h-full"
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/add" element={<AddApplication />} />
              <Route path="/app/:id" element={<Detail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <CommandPalette />
      </ViewProvider>
    </AppDataProvider>
  )
}
