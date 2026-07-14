import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily CAT",
  description: "A daily CAT-prep ritual: Quant in the morning, VARC in the afternoon, LRDI in the evening.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#191512" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (Grammarly, password
          managers) inject attributes into <html>/<body> before React hydrates,
          which is noise, not a bug. This only silences attribute mismatches on
          these two elements — real mismatches in children still warn. */}
      <body className="antialiased min-h-dvh" suppressHydrationWarning>
        <div className="mx-auto max-w-md px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
