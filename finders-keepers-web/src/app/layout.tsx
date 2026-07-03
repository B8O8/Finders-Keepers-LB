import "./globals.css";

import type { Metadata } from "next";

import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = {
  title: "Finders Keepers",
  description: "Premium fashion and accessories",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}