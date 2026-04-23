import { ArrowLeft, Sparkles } from "lucide-react";
import KeywordMemeSearch from "./KeywordMemeSearch";

export default function MoodMemeSearchPage({ onBackHome, onUploadToRoastRiot }) {
  return (
    <section className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              <Sparkles size={12} />
              Global Meme
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Search global memes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Search meme images across the web by mood, vibe, or situation and preview them right here without leaving the app.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
          >
            <ArrowLeft size={16} />
            Back to home
          </button>
        </div>

        <div className="mt-6">
          <KeywordMemeSearch onUploadToRoastRiot={onUploadToRoastRiot} />
        </div>
      </div>
    </section>
  );
}
