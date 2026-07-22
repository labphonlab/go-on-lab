"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // offline support is a nice-to-have; a failed registration
        // shouldn't block anything else on the page
      });
    }
  }, []);

  return null;
}
