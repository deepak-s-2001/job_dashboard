import type { JobDashboardApi } from './index'

declare global {
  interface Window {
    api: JobDashboardApi
  }
}

export {}
