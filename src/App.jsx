import { useEffect, useMemo, useState } from "react";
import CategoryFilter from "./components/CategoryFilter";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import MemeGrid from "./components/MemeGrid";
import MemeModal from "./components/MemeModal";
import SearchBar from "./components/SearchBar";
import { memes } from "./data/memes";
import { categories, smartSearch, suggestions } from "./utils/helpers";

function getInitialFavorites() {
  try {
    const savedFavorites = localStorage.getItem("favorite-memes");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeMeme, setActiveMeme] = useState(null);
  const [favorites, setFavorites] = useState(getInitialFavorites);

  useEffect(() => {
    localStorage.setItem("favorite-memes", JSON.stringify(favorites));
  }, [favorites]);

  const filteredMemes = useMemo(
    () => smartSearch(memes, search, selectedCategory),
    [search, selectedCategory]
  );

  function toggleFavorite(id) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <div className="relative isolate overflow-hidden">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070B14]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
                Meme Finder
              </p>
              <h1 className="text-lg font-semibold sm:text-xl">
                Search by mood, category, and situation
              </h1>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              Favorites: {favorites.length}
            </div>
          </div>
        </header>

        <Hero />

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <SearchBar
              search={search}
              setSearch={setSearch}
              suggestions={suggestions}
            />
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          </section>

          <section className="mt-10">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">Meme Results</h2>
                <p className="text-zinc-400">
                  {filteredMemes.length} meme
                  {filteredMemes.length === 1 ? "" : "s"} found
                </p>
              </div>

              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 transition hover:bg-white/10"
                >
                  Clear search
                </button>
              ) : null}
            </div>

            <MemeGrid
              memes={filteredMemes}
              onOpen={setActiveMeme}
              toggleFavorite={toggleFavorite}
              favorites={favorites}
              setSearch={setSearch}
            />
          </section>
        </main>

        <Footer />
        <MemeModal
          meme={activeMeme}
          onClose={() => setActiveMeme(null)}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
        />
      </div>
    </div>
  );
}
