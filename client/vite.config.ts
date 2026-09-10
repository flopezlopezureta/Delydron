import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // DroneControl's own backend (server.js), not Full Envios' — see
      // .claude/launch.json's "dronecontrol-server" entry (port 3001).
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
