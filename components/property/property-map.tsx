"use client";

import * as React from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  areaName: string;
}

export function PropertyMap({ latitude, longitude, areaName }: PropertyMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maptilersdk.Map | null>(null);

  React.useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (!apiKey || !containerRef.current) return;

    maptilersdk.config.apiKey = apiKey;

    const map = new maptilersdk.Map({
      container: containerRef.current,
      style: maptilersdk.MapStyle.STREETS.PASTEL,
      center: [longitude, latitude],
      zoom: 13,
      // Avoid scroll-jacking the page; require Ctrl/⌘ + scroll to zoom.
      scrollZoom: false,
      // MapTiler SDK adds these by default — disable them so we can
      // mount a single, customised navigation control without a compass.
      navigationControl: false,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.addControl(new maptilersdk.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // Approximate-location indicator: a translucent pixel circle, not
      // a true geographic radius. Mirrors the privacy pattern Airbnb
      // uses on listing pages — gives a sense of the area without
      // exposing the exact address.
      map.addSource("property-area", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        },
      });

      map.addLayer({
        id: "property-area-fill",
        type: "circle",
        source: "property-area",
        paint: {
          "circle-radius": 70,
          "circle-color": "#0ea5e9",
          "circle-opacity": 0.2,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0ea5e9",
          "circle-stroke-opacity": 0.7,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  if (!process.env.NEXT_PUBLIC_MAPTILER_API_KEY) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
        Map unavailable — set <code className="mx-1">NEXT_PUBLIC_MAPTILER_API_KEY</code> in .env.local
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-neutral-200"
        aria-label={`Map showing the approximate location of the property in ${areaName}`}
        role="img"
      />
      <p className="text-xs text-neutral-500">
        Approximate location only. The exact address is shared after booking.
      </p>
    </div>
  );
}
