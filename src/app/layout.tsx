import { Outfit } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ReactQueryProvider } from '@/lib/react-query';

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Step Fitness Admin Dashboard",
  description: "One Step Fitness class management dashboard",
  icons: {
    icon: "/favicon.png?v=20260501-admin",
    shortcut: "/favicon.png?v=20260501-admin",
    apple: "/apple-touch-icon.png?v=20260501-admin",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=20260501-admin" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png?v=20260501-admin" />
        <link rel="shortcut icon" href="/favicon.png?v=20260501-admin" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260501-admin" />
      </head>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <ToastProvider>
            <ReactQueryProvider>
              <AuthProvider>
                <SidebarProvider>{children}</SidebarProvider>
              </AuthProvider>
            </ReactQueryProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
