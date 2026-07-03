import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Under Maintenance — Finders Keepers',
  description: 'We will be back shortly.',
  robots: 'noindex',
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body { background: #0a0a0f !important; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
      {children}
    </>
  );
}
