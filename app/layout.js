// ── Root Layout ────────────────────────────────────────────
import './globals.css';
import Navbar from '../components/layout/Navbar';

export const metadata = {
  title:       'The Daily Stack',
  description: 'Your hub for gaming strategies, life hacks, and more.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          background: 'var(--color-bg-base)',
          color:      'var(--color-text-primary)',
          minHeight:  '100vh',
        }}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}