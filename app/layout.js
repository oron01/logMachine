import { VT323, Quicksand } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
});

export const metadata = {
  title: "Proof Log 🎮",
  description: "Your cozy retro daily accomplishment logger. Track your habits and wins in style.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${vt323.variable} ${quicksand.variable}`}>
      <body>{children}</body>
    </html>
  );
}

