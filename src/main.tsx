// =============================================================
// POLYFILL: Promise.withResolvers (ES2024)
// Required for older browsers: Chrome < 119, Safari < 17.4, Firefox < 121
// This MUST be at the very top before any other imports
// =============================================================

// TypeScript declaration for the polyfill
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

if (typeof Promise.withResolvers !== "function") {
  (Promise as any).withResolvers = function <T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  } {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Import equivalence tests for debug (exposes window.__runEquivalenceTests)
import "./debug/runEquivalenceTests";

// Global error handlers for catching errors before React mounts
window.addEventListener("error", (event) => {
  console.error("Global error caught:", event.error);
  // Show fallback UI if React hasn't mounted yet
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: white; font-family: system-ui, sans-serif;">
        <div style="text-align: center; padding: 2rem; max-width: 400px;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Erro ao carregar</h1>
          <p style="color: #888; margin-bottom: 1.5rem;">Ocorreu um erro ao iniciar a aplicação. Tente recarregar a página.</p>
          <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Recarregar
          </button>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.href='/auth'" style="margin-left: 0.5rem; padding: 0.75rem 1.5rem; background: #ef4444; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Limpar Cache
          </button>
        </div>
      </div>
    `;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

// Safely get the root element
const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Failed to render app:", error);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: white; font-family: system-ui, sans-serif;">
        <div style="text-align: center; padding: 2rem; max-width: 400px;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Erro crítico</h1>
          <p style="color: #888; margin-bottom: 1.5rem;">Não foi possível iniciar a aplicação.</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload()" style="padding: 0.75rem 1.5rem; background: #ef4444; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Limpar Cache e Recarregar
          </button>
        </div>
      </div>
    `;
  }
} else {
  console.error("Root element not found!");
}
