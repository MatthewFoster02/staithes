"use client";

import * as React from "react";
import Script from "next/script";

interface PlausibleProps {
  /** The Plausible domain — i.e. what's set up on plausible.io. Stored
   *  in SiteConfiguration.analyticsId so the host can edit it without
   *  redeploying. Pass `null` to disable analytics entirely. */
  domain: string | null;
}

// Loads the Plausible script and exposes `window.plausible(name, opts)`
// for custom events. Privacy-first: no cookies, no consent banner
// needed. We render only when the domain is set, so analytics is
// strictly opt-in via the admin settings.
export function PlausibleScript({ domain }: PlausibleProps) {
  if (!domain) return null;
  return (
    <Script
      defer
      strategy="afterInteractive"
      data-domain={domain}
      src="https://plausible.io/js/script.tagged-events.outbound-links.js"
    />
  );
}

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

// Fires a custom Plausible event on mount. Idempotent per mount —
// re-renders don't double-fire because the effect's dep array is
// the event name itself. Safe when Plausible isn't loaded: the
// guard skips the call.
export function TrackEvent({
  name,
  props,
}: {
  name: string;
  props?: Record<string, string | number | boolean>;
}) {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Plausible may not have loaded yet. Retry a couple of times so
    // we don't drop events on slow clients without polluting forever.
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (typeof window.plausible === "function") {
        window.plausible(name, props ? { props } : undefined);
        return;
      }
      if (attempts < 10) setTimeout(tick, 250);
    };
    tick();
    // We intentionally don't depend on `props` — the props are
    // metadata for the same single event and shouldn't re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
