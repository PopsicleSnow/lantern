import { JournalistSessionProvider } from '@/lib/journalist/session';

export default function JournalistLayout({ children }: { children: React.ReactNode }) {
  return <JournalistSessionProvider>{children}</JournalistSessionProvider>;
}
