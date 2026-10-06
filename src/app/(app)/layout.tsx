import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './app.css';
import { AuthProvider } from '@/components/app/auth';
import { ToastProvider } from '@/components/app/ui';

export const metadata: Metadata = {
  title: { default: 'Despina Pharma', template: '%s | Despina Pharma' },
  robots: { index: false, follow: false },
  icons: {
    icon: {
      type: 'image/svg+xml',
      url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23112a46'/%3E%3Cpath d='M9 7h6a9 9 0 010 18H9V7zm4 4v10h2a5 5 0 000-10z' fill='%230ec4df'/%3E%3C/svg%3E",
    },
  },
};

export const viewport: Viewport = { themeColor: '#112a46' };

/** Root layout for the customer workspace, staff dashboard and login screens. */
export default function AppRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
