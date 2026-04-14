//Landing Page
import Link from 'next/link';

// Feature card data
const features = [
  {
    icon: '🧠',
    title: 'Neural Networks',
    desc: 'Explore deep learning architectures and how they mimic the human brain.',
  },
  {
    icon: '📊',
    title: 'Data Analytics',
    desc: 'Transform raw datasets into meaningful insights with statistical tools.',
  },
  {
    icon: '🤖',
    title: 'Model Training',
    desc: 'Build, train, and evaluate machine learning models in the cloud.',
  },
  {
    icon: '🚀',
    title: 'Deployment',
    desc: 'Ship your models to production and serve predictions at scale.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black flex flex-col">

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-bold text-white tracking-tight">ML Hub</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign In →
        </Link>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 bg-gray-900 border border-gray-700 text-gray-400 text-xs font-medium px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Now Live on Vercel
        </span>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
          Machine{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-gray-500">
            Learning
          </span>
          <br />
          Hub
        </h1>

        {/* Description */}
        <p className="max-w-xl text-gray-400 text-lg leading-relaxed mb-10">
          A simple, integrated platform for exploring machine learning concepts.
          Powered by{' '}
          <span className="text-white font-medium">Supabase Authentication</span>{' '}
          and deployed seamlessly on{' '}
          <span className="text-white font-medium">Vercel</span>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="bg-white text-black font-semibold px-8 py-3 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Get Started
          </Link>
          <a
            href="#features"
            className="border border-gray-700 text-gray-300 font-medium px-8 py-3 rounded-lg hover:border-gray-500 hover:text-white transition-colors text-sm"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* ── FEATURES GRID ─────────────────────────────────────── */}
      <section id="features" className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-gray-500 text-sm font-semibold uppercase tracking-widest mb-10">
            What's Inside
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATION BANNER ────────────────────────────────── */}
      <section className="border-t border-gray-900 bg-gray-950 px-6 py-10">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 text-gray-600 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-white font-medium text-base">Browser</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-2">
            <span className="text-white font-medium text-base">Next.js Frontend</span>
            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">on Vercel</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-2">
            <span className="text-white font-medium text-base">Supabase Auth</span>
          </span>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-gray-900 px-6 py-6 text-center text-gray-700 text-xs">
        Machine Learning Hub · INFOT6 Lab Exercise 3 · Built with Next.js, Supabase &amp; Vercel
      </footer>
    </main>
  );
}