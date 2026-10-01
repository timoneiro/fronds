/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** See src/lib/newsletter.ts. */
  readonly VITE_BUTTONDOWN_USERNAME?: string
}
