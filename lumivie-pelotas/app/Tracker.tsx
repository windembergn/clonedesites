"use client";

import { useEffect } from "react";
import { initTracking } from "./track";

/** Roda a medição uma vez, no cliente. */
export default function Tracker({ site }: { site: string }) {
  useEffect(() => {
    initTracking(site);
  }, [site]);
  return null;
}
