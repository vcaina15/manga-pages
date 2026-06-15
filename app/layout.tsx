import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manga Booklet Imposer',
  description: 'RTL booklet imposition with spread splitting — runs in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
