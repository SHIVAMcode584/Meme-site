import { Search } from "lucide-react";

export default function SearchBar({ search, setSearch, suggestions }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search like: friend acting rich, teacher asking homework..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 sm:h-16 pl-14 pr-5 rounded-2xl bg-[#101624] border border-white/10 text-white placeholder:text-zinc-500 outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20 transition"
        />
      </div>

      <div className="flex flex-wrap gap-3 mt-5 justify-center">
        {suggestions.map((item, index) => (
          <button
            key={index}
            onClick={() => setSearch(item)}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-300 hover:bg-white/10 transition"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}