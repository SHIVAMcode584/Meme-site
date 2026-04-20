import { Mail, ExternalLink, Heart } from "lucide-react";

// Brand icons like Twitter and Instagram were removed in newer versions of lucide-react.
// We define them as local components here to keep the footer self-contained.
const Twitter = ({ size = 24, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const Instagram = ({ size = 24, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const GithubIcon = ({ size = 24, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-3">
          <div className="space-y-4">
            <h2 className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-2xl font-black tracking-tighter text-transparent">
              RoastRiot.meme
            </h2>
            <p className="leading-relaxed text-[color:var(--app-muted)]">
              The ultimate destination to discover and create the perfect memes for every situation.
              Search memes by mood, reaction, reply, or real-life situations.
              Join thousands of creators sharing humor daily.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[color:var(--app-text)]">Explore</h3>
            <nav className="flex flex-col gap-2 text-[color:var(--app-muted)]">
              <a href="#" className="inline-flex items-center gap-2 transition-colors hover:text-violet-400">
                Trending Memes <ExternalLink size={14} />
              </a>
              <a href="#" className="transition-colors hover:text-violet-400">Meme Editor</a>
              <a href="#" className="transition-colors hover:text-violet-400">All Categories</a>
              <a href="#" className="transition-colors hover:text-violet-400">Search by Situation</a>
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[color:var(--app-text)]">Get in Touch</h3>
            <div className="flex gap-4">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/80 p-3 text-[color:var(--app-muted)] transition hover:bg-violet-500/20 hover:text-[color:var(--app-text)]"
                aria-label="Follow us on Twitter"
              >
                <Twitter size={20} className="transition-transform group-hover:scale-110" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/80 p-3 text-[color:var(--app-muted)] transition hover:bg-violet-500/20 hover:text-[color:var(--app-text)]"
                aria-label="Follow us on Instagram"
              >
                <Instagram size={20} className="transition-transform group-hover:scale-110" />
              </a>
              <a
                href="mailto:support@memefinder.com"
                className="group rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/80 p-3 text-[color:var(--app-muted)] transition hover:bg-violet-500/20 hover:text-[color:var(--app-text)]"
                aria-label="Email Support"
              >
                <Mail size={20} className="transition-transform group-hover:translate-y-[-2px]" />
              </a>
              <a
                href="https://github.com/SHIVAMcode584"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/80 p-3 text-[color:var(--app-muted)] transition hover:bg-violet-500/20 hover:text-[color:var(--app-text)]"
                aria-label="GitHub"
              >
                <GithubIcon size={20} className="transition-transform group-hover:scale-110" />
              </a>
            </div>
            <p className="text-sm text-[color:var(--app-muted)]">
              Drop me a line at: <br />
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=shivampixel1@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-medium text-[color:var(--app-text)] transition-colors hover:text-violet-400"
              >
                shivampixel1@gmail.com
              </a>
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-[color:var(--app-border)]/50 pt-8 text-sm text-[color:var(--app-muted)] md:flex-row">
          <div className="text-center md:text-left">
            <p>Copyright 2026 RoastRiot.meme. All Rights Reserved.</p>
            <p className="mt-1 text-xs text-[color:var(--app-muted)]">
              Developed with{" "}
              <Heart size={14} className="inline-block align-[-2px] text-rose-400 fill-current" aria-hidden="true" />{" "}
              by <span className="font-semibold text-violet-400/80">Shivam Kumar</span>
            </p>
          </div>
          <div className="flex gap-8 text-xs uppercase tracking-widest">
            <a href="#" className="transition-colors hover:text-[color:var(--app-text)]">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-[color:var(--app-text)]">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
