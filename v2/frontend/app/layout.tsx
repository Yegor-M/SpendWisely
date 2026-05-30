import type { Metadata } from "next";
import { Inter, Instrument_Serif, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SpendWisely",
  description: "Personal finance tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-auto">
          {children}
        </div>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
