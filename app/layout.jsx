import "./globals.css";

export const metadata = {
  title: "GM06 Investment Club",
  description: "Green Minds 06 Investment Club — Portfolio Management Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GM06",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F766E",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.setAttribute('data-theme',localStorage.getItem('gm06_theme')||'dark')}catch(e){}` }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
