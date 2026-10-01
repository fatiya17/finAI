"use client";

import { useEffect, useState } from "react";
import { getInitialState, saveState, AppState, UserProfile } from "@/lib/store";
import { Onboarding } from "@/components/Onboarding";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(getInitialState());
  }, []);

  const handleOnboardingComplete = (profile: UserProfile, categories: any[]) => {
    const newState = { ...state!, profile, categories };
    setState(newState);
    saveState(newState);
  };

  if (!state) return null; // Hydration waiting

  if (!state.profile.isOnboarded) {
    return <Onboarding state={state} onComplete={handleOnboardingComplete} />;
  }

  return <Dashboard state={state} setState={(s) => {
    setState(s);
    saveState(s);
  }} />;
}
