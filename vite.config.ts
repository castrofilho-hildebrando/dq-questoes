import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force a single React instance (fixes dispatcher=null / useState errors)
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
