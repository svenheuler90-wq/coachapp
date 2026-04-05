import "./globals.css";

export const metadata = {
  title: "CoachFlow",
  description: "Coach & Athleten App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}