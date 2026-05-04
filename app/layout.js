// ── Root Layout ────────────────────────────────────────────
import './globals.css';
import Navbar             from '../components/layout/Navbar';
import NotificationToast  from '../components/layout/NotificationToast';
// Import your UserProvider here
import { UserProvider }   from '../hooks/useUser'; 

export const metadata = {
  title:       'ML-Hub · The Daily Stack',
  description: 'A community platform for sharing articles, research, and ideas.',
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
        {/* Wrap everything in the Provider */}
        <UserProvider>
          <Navbar />
          <NotificationToast />
          <main>
            {children}
          </main>
        </UserProvider>
      </body>
    </html>
  );
}