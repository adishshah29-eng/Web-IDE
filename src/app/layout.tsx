import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { DialogProvider } from "@/components/DialogProvider";

export const metadata: Metadata = {
  title: "Online IDE",
  description: "A browser-based multi-language IDE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <DialogProvider>{children}</DialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
