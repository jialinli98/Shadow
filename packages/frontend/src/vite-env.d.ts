/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_REGISTRY_ADDRESS: string
  readonly VITE_FEE_MANAGER_ADDRESS: string
  readonly VITE_SETTLEMENT_HOOK_ADDRESS: string
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
