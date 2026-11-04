"use client";

import { useEffect, useState } from "react";

/** Phones (under 768px wide) get the full-screen map layout; tablets, Chromebooks and computers keep the regular one. */
export const PHONE_QUERY = "(max-width: 767px)";

export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}
