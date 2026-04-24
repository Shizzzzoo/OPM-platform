import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Nav from "./nav";

export const metadata: Metadata = { title: "OPM Platform" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Providers>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
