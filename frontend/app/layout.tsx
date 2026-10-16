import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import ConsoleFilter from "@/components/ConsoleFilter";
import Nav from "@/components/Nav";
import VoiceGuide from "@/components/VoiceGuide";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Poise — AI Interview Coach",
  description: "Voice mock interviews with live posture, delivery and think-aloud feedback.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ConsoleFilter />
        <Nav />
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 sm:px-6">{children}</main>
        <VoiceGuide />
      </body>
    </html>
  );
}
