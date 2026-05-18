import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react({})],

    css: {
        preprocessorOptions: {
            scss: {
                api: "modern-compiler"
            }
        }
    },

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    },
    build: {
        sourcemap: true,
        chunkSizeWarningLimit: 5000,
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, "index.html")
            }
        }
    }
})
