import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Putra Glass - Kalkulator Penawaran',
  description: 'Kalkulator Penawaran & PDF Cermin LED Custom Putra Glass',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#F2F5F9] text-[#1B2233] antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
