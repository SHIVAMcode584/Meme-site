export default function CategoryFilter({
  categories,
  selectedCategory,
  setSelectedCategory,
}) {
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-5 py-2 rounded-full border text-sm transition ${
              selectedCategory === cat
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 border-transparent text-white shadow-lg shadow-fuchsia-500/20"
                : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}