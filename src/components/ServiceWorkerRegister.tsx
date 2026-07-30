"use client";
import { useEffect } from "react";

// Enregistre le service worker (PWA installable / cache d'app-shell léger).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // pas de SW en dev
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencieux : l'app fonctionne sans SW */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
