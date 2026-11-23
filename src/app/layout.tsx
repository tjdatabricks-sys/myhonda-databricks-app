import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";


export const metadata: Metadata = {
  title: "myhonda Marketing IQ — Gold Layer Analytics",
  description:
    "Enterprise marketing analytics on the myhonda Gold layer: campaign performance, acquisition funnel, paid media, omnichannel, contribution, finance reconciliation, targets, experiments and brand lift.",
  keywords: ["marketing analytics", "gold layer", "databricks", "campaign performance", "acquisition", "BI"],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
