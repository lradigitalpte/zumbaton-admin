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
  title: "Zumbaton Admin Dashboard",
  description: "Zumbaton fitness class management dashboard",
  icons: {
    icon: [
      { url: "/images/logo/logo fav.png", type: "image/png" },
      { url: "/images/logo/logo fav.png", sizes: "32x32", type: "image/png" },
      { url: "/images/logo/logo fav.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/images/logo/logo fav.png",
    apple: "/images/logo/logo fav.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
