import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5001';

    return {
        plugins: [react()],
        server: {
            port: 3000,
            proxy: {
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                },
                '/uploads': {
                    target: backendUrl,
                    changeOrigin: true,
                }
            }
        }
    }
})
