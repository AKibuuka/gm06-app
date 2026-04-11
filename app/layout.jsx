import "./globals.css";

export const metadata = {
  title: "GM06 Investment Club",
  description: "Green Minds 06 Investment Club — Portfolio Management Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
