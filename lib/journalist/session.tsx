'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface JournalistSession {
  journalist_id: string;
  public_key: string;
  secret_key: Uint8Array;
}

interface SessionContextValue {
  session: JournalistSession | null;
  setSession: (s: JournalistSession | null) => void;
}

const Ctx = createContext<SessionContextValue | null>(null);

export function JournalistSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<JournalistSession | null>(null);
  return <Ctx.Provider value={{ session, setSession }}>{children}</Ctx.Provider>;
}

export function useJournalistSession(): SessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useJournalistSession must be used within JournalistSessionProvider');
  return ctx;
}
