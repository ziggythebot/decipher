import type { Metadata } from "next";
import "./globals.css";
import { PrivyAuthProvider } from "@/components/providers/PrivyAuthProvider";
import { PrivySessionBridge } from "@/components/auth/PrivySessionBridge";

export const metadata: Metadata = {
  title: "Decipher",
  description: "Structured language acquisition app for fast conversational fluency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PrivyAuthProvider>
          <PrivySessionBridge />
          {children}
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
