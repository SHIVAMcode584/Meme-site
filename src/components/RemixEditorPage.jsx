import { ArrowLeft, BadgeCheck, Layers3, MousePointer2, Sparkles } from "lucide-react";
import MemeEditor from "./MemeEditor";

const modalChips = [
  "Original stays untouched",
  "Drag captions live",
  "Save as a new meme",
];

const pageHighlights = [
  {
    label: "Original protected",
    value: "Saving creates a new post and leaves the source untouched.",
  },
  {
    label: "Live canvas",
    value: "Drag captions on the image while the preview stays in view.",
  },
  {
    label: "Fast export",
    value: "Download a clean preview or publish the remix from the same place.",
  },
];

export default function RemixEditorPage({
  user,
  isBlockedUser = false,
  isModal = false,
  onBack,
  onUpload,
  onSuccess,
}) {
  const shellClassName = isModal
    ? "relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent text-white"
    : "relative min-h-screen overflow-hidden bg-[#070B14] text-white";

  const contentClassName = isModal
    ? "relative flex h-full min-h-0 flex-col p-3 sm:p-4"
    : "relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8";

  const panelClassName = isModal
    ? "rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,24,0.96),rgba(7,11,20,0.9))] px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-2xl sm:px-5 sm:py-4"
    : "rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7 lg:p-10";

  const editorWrapperClassName = isModal
    ? "mt-4 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar"
    : "mt-8";

  const primaryActionLabel = isModal ? "Close editor" : "Back";

  return (
    <div className={shellClassName}>
      {!isModal ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_42%),linear-gradient(180deg,rgba(7,11,20,0.75),rgba(7,11,20,0.96))]" />
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-500/18 blur-3xl" />
          <div className="absolute right-[-4rem] top-16 h-96 w-96 rounded-full bg-cyan-500/12 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/4 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.35),rgba(2,6,23,0.86))]" />
        </div>
      )}

      <div className={contentClassName}>
        <div className={panelClassName}>
          {isModal ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Remix studio
                  </div>
                  <div className="mt-2 flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-3">
                    <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                      Edit meme
                    </h1>
                    <p className="text-sm text-zinc-400">
                      Keep the original safe and jump straight into the preview and controls.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onBack}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  <ArrowLeft size={16} />
                  {primaryActionLabel}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <BadgeCheck size={13} className="text-emerald-400" />
                  {modalChips[0]}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <MousePointer2 size={13} className="text-cyan-400" />
                  {modalChips[1]}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Layers3 size={13} className="text-violet-400" />
                  {modalChips[2]}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 border-b border-white/10 pb-6 sm:gap-8 sm:pb-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Remix workspace
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                      Shape the remix
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                      Start from an existing meme, keep the original post untouched, and publish a
                      fresh version with cleaner controls and live drag-and-drop positioning.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {pageHighlights.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/5 bg-black/40 px-5 py-4 transition-colors hover:border-white/10"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300/80">
                          {item.label}
                        </p>
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-zinc-300">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3">
                  <button
                    onClick={onBack}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-zinc-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
                  >
                    <ArrowLeft size={16} />
                    {primaryActionLabel}
                  </button>

                  <div className="rounded-2xl border border-white/5 bg-black/40 px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                      Mode
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">Remix flow</p>
                    <p className="mt-1 text-xs text-zinc-500">Edit and save as a new post</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-2">
                  <BadgeCheck size={14} className="text-emerald-400" />
                  Original post stays untouched
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-2">
                  <MousePointer2 size={14} className="text-cyan-400" />
                  Drag text directly on the canvas
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-2">
                  <Layers3 size={14} className="text-violet-400" />
                  Clean remix controls in one popup
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={editorWrapperClassName}>
          <MemeEditor
            user={user}
            onUpload={onUpload}
            onSuccess={onSuccess}
            isBlockedUser={isBlockedUser}
            isModal={isModal}
          />
        </div>
      </div>
    </div>
  );
}
