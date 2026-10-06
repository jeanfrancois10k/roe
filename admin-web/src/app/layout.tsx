import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ROE BOLET - Administration Centrale',
  description: 'Plateforme de gestion et supervision multi-vendeurs de loterie ROE BOLET',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-roe-bg text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
