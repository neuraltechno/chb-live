import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Gamebloc - Live Sports Chat",
  description:
    "Real-time sports chat platform. Join the conversation during live games across soccer, NCAA, and more.",
  keywords: [
    "sports",
    "chat",
    "live",
    "soccer",
    "NCAA",
    "Premier League",
    "Champions League",
    "football",
  ],
  openGraph: {
    title: "Gamebloc - Live Sports Chat",
    description:
      "Real-time sports chat platform. Join the conversation during live games.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-950 text-white">
        <ConvexClientProvider>
          <Navbar />
          <main className="pt-16 min-h-screen">{children}</main>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e293b",
                color: "#f1f5f9",
                border: "1px solid rgba(51, 65, 85, 0.5)",
                borderRadius: "12px",
                fontSize: "14px",
              },
            }}
          />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
