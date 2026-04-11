import "./globals.css";

export const metadata = {
  title: "GM06 Investment Club",
  description: "Green Minds 06 Investment Club — Portfolio Management Platform",
  manifest: "/manifest.json",
  themeColor: "#0F766E",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GM06",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
