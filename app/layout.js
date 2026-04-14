
import './globals.css';

export const metadata = {
  title: 'Machine Learning Hub',
  description: 'A simple integrated web app using Supabase and Vercel.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}