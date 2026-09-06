/// <reference types="vite/client" />

declare module '*?url' {
  const src: string
  export default src
}

import 'react'
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
