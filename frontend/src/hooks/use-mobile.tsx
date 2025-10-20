import { useState, useEffect } from "react";

function computeIsMobile(): boolean {
  try {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hoverNone = window.matchMedia && window.matchMedia('(hover: none)').matches;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    // Treat as mobile when device has coarse pointer/hover none OR UA indicates mobile
    // or when the smaller viewport edge is under 768px (handles landscape phones like S24 Ultra)
    return (coarse && hoverNone) || uaMobile || minSide < 768;
  } catch {
    return true; // conservative default
  }
}

export function useMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(computeIsMobile());

  useEffect(() => {
    const checkMobile = () => setIsMobile(computeIsMobile());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile as any);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile as any);
    };
  }, []);

  return isMobile;
}
