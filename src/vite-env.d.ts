/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly PROD: boolean
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: string
  export default content
}

declare module 'leaflet/dist/leaflet.css' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}
