import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles/globals.css'

import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ToastProvider>
      <App />
    </ToastProvider>
  </HashRouter>,
)
