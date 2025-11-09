import "server-only";

import { StackServerApp } from "@stackframe/stack";

let _stackServerApp: StackServerApp | null = null;

// Initialize Stack Auth lazily
function initializeStackAuth(): StackServerApp {
  if (!_stackServerApp) {
    try {
      _stackServerApp = new StackServerApp({
        tokenStore: "nextjs-cookie",
        urls: {
          afterSignIn: "/dashboard",
        },
      });
    } catch (error) {
      console.error("Failed to initialize Stack Auth:", error);
      throw new Error("Stack Auth initialization failed. Check environment variables.");
    }
  }
  return _stackServerApp;
}

// Helper function to get Stack Auth instance safely
export function getStackServerApp(): StackServerApp {
  return initializeStackAuth();
}

// Create a proxy object that initializes on first access
export const stackServerApp = new Proxy({} as StackServerApp, {
  get(target, prop) {
    const app = initializeStackAuth();
    const value = (app as any)[prop];
    return typeof value === "function" ? value.bind(app) : value;
  },
});
