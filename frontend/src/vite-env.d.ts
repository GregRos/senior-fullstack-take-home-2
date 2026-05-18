/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL of the Teach Yourself FastAPI backend, e.g. "http://localhost:8888". */
    readonly VITE_SERVER_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
