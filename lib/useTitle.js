"use client";
import { useEffect } from "react";

export default function useTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — GM06`;
    return () => { document.title = prev; };
  }, [title]);
}
