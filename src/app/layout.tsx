import "@/styles/globals.css";

import { type Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/react";
import { cn } from "@/lib/utils";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  axes: ["wdth"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Commishop",
  description:
    "Your fantasy basketball commissioner desk — power rankings, matchups, and league intel.",
  icons: [
    { rel: "icon", url: "/brand/commishop-mark.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/brand/commishop-mark.svg" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", archivo.variable, jetbrainsMono.variable)}
    >
      <body>
        <TRPCReactProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
