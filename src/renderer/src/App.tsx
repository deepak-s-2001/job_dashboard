import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { AppDataProvider } from './lib/store'
import { ViewProvider } from './lib/view'
import { AppShell } from './components/AppShell'
import { CommandPalette } from './components/CommandPalette'
import { Overview } from './routes/Overview'
import { Applications } from './routes/Applications'
import { AddApplication } from './routes/Add'
import { Import } from './routes/Import'
import { Detail } from './routes/Detail'
import { Network } from './routes/Network'
import { Todos } from './routes/Todos'
import { Settings } from './routes/Settings'

export function App() {
  const location = useLocation()
  return (
    <MotionConfig reducedMotion="user">
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
              <Route path="/" element={<Overview />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/add" element={<AddApplication />} />
              <Route path="/import" element={<Import />} />
              <Route path="/app/:id" element={<Detail />} />
              <Route path="/todos" element={<Todos />} />
              <Route path="/network" element={<Network />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <CommandPalette />
      </ViewProvider>
    </AppDataProvider>
    </MotionConfig>
  )
}
