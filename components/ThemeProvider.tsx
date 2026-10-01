"use client";

import { useEffect, useState } from "react";
import { getInitialState } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const state = getInitialState();
    setMounted(true);
    
    if (state.profile.themeMode === "dark" || (state.profile.themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Apply primary color from accentColor preference
    const colorMap: Record<string, string> = {
      blue: "205 71% 41%", // #1e73b1
      violet: "263 42% 56%", // #8560c0
      pink: "338 100% 73%", // #ff73a7
      yellow: "36 100% 67%", // #ffbd59
      green: "150 38% 54%", // #5cb588
    };

    const darkColorMap: Record<string, string> = {
      blue: "201 100% 91%", // #d1efff
      violet: "263 100% 88%", // #d9c2ff
      pink: "338 100% 91%", // #ffd1e2
      yellow: "56 87% 85%", // #faf6b7
      green: "149 68% 75%", // #99e7bf
    };

    const isDark = document.documentElement.classList.contains("dark");
    const hueSatLight = isDark ? (darkColorMap[state.profile.accentColor] || darkColorMap["blue"]) : (colorMap[state.profile.accentColor] || colorMap["blue"]);
    
    document.documentElement.style.setProperty("--primary", hueSatLight);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 opacity-0 transition-opacity duration-300"></div>;
  }

  return <>{children}</>;
}
