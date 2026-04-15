import { AVATAR_PRESETS, getAvatarUrlById } from "../utils/avatarOptions";

export default function AvatarPicker({
  selectedAvatarId,
  onSelect,
  disabled = false,
  className = "",
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`.trim()}>
      {AVATAR_PRESETS.map((avatar) => {
        const isSelected = avatar.id === selectedAvatarId;

        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`rounded-2xl border p-3 text-center transition-all ${
              isSelected
                ? "border-violet-400 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                : "border-white/10 bg-white/5 hover:border-violet-400/40 hover:bg-white/10"
            } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <img
              src={getAvatarUrlById(avatar.id)}
              alt={`${avatar.label} avatar`}
              className="mx-auto h-16 w-16 rounded-full border border-white/10 bg-[#111827] object-cover"
            />
            <span className="mt-2 block text-xs font-semibold text-zinc-200">{avatar.label}</span>
          </button>
        );
      })}
    </div>
  );
}
