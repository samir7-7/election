import './globals.css';

export const metadata = {
  title: 'Nepal Election Results — Live Updates',
  description: 'Real-time election results for Nepal. Track vote counts, constituency results, and party standings across all 165 House of Representatives constituencies.',
  keywords: 'Nepal election, election results, vote count, Nepal 2026, constituencies, Kathmandu',
  openGraph: {
    title: 'Nepal Election Results — Live',
    description: 'Real-time election results for Nepal. Track constituency results, party standings, and vote counts.',
    locale: 'en_US',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1917',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Serif:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
