import { useEffect, useMemo, useState } from "react";
import logo from "../meme-logo.png";
import { Sparkles, Menu, X, Home, Search, Dices, Pencil, Upload, LogIn, LogOut, Image } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import CategoryFilter from "./components/CategoryFilter";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import MemeGrid from "./components/MemeGrid";
import MemeModal from "./components/MemeModal";
import SearchBar from "./components/SearchBar";
import { memes } from "./data/memes";
import UploadMeme from "./components/UploadMeme";
import MemeEditor from "./components/MemeEditor";
import { categories, smartSearch, suggestions } from "./utils/helpers";
import LoginModal from "./components/LoginModal";
import Auth from './components/Auth'
import { supabase } from "./lib/supabase";

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
 const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [userMemes, setUserMemes] = useState(() => {
    try {
      const saved = localStorage.getItem("user-uploaded-memes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const SidebarLink = ({ icon, label, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-3 sm:gap-4 w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all group"
    >
      <div className="group-hover:scale-110 transition-transform text-violet-400 scale-90 sm:scale-100">{icon}</div>
      <span className="font-medium">{label}</span>
    </button>
  );

  useEffect(() => {
    localStorage.setItem("favorite-memes", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("user-uploaded-memes", JSON.stringify(userMemes));
  }, [userMemes]);

useEffect(() => {
  const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
  };
  getUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_, session) => {
      setUser(session?.user ?? null);
    }
  );
    return () => {
      subscription.unsubscribe();
    };
}, []);

 const filteredMemes = useMemo(
  () => smartSearch(viewMode === "uploads" ? userMemes : [...userMemes, ...memes], search, selectedCategory),
  [search, selectedCategory, userMemes, viewMode]
);

  function toggleFavorite(id) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

  const openMeme = (meme) => {
    setActiveMeme(meme);
    const url = new URL(window.location);
    url.searchParams.set("meme", meme.id);
    window.history.replaceState({}, "", url);
  };

  const closeModal = () => {
    setActiveMeme(null);
    const url = new URL(window.location);
    url.searchParams.delete("meme");
    window.history.replaceState({}, "", url);
  };

  const handleRandomMeme = () => {
    const allAvailableMemes = [...userMemes, ...memes];
    const randomIndex = Math.floor(Math.random() * allAvailableMemes.length);
    openMeme(allAvailableMemes[randomIndex]);
  };

  const handleLogin = (user) => {
    // Supabase session listener handles state update
    setIsLoginModalOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUploadMeme = (meme) => {
    setUserMemes((prev) => [meme, ...prev]);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-10">
        <div className="font-black text-xl tracking-tighter bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          MEME HUB
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-full text-zinc-500">
          <X size={20} />
        </button>
      </div>
      <nav className="space-y-1">
        <SidebarLink icon={<Home size={20}/>} label="Memes" onClick={() => { setViewMode("all"); setIsSidebarOpen(false); window.scrollTo({top: 0, behavior: 'smooth'}); }} />
        <SidebarLink icon={<Search size={20}/>} label="Search" onClick={() => { setIsSidebarOpen(false); document.querySelector('input')?.focus(); }} />
        <SidebarLink icon={<Dices size={20}/>} label="Random Meme" onClick={() => { setIsSidebarOpen(false); handleRandomMeme(); }} />
        {user && (
          <SidebarLink 
            icon={<Image size={20}/>} 
            label="My Uploads" 
            onClick={() => { 
              setViewMode("uploads");
              setIsSidebarOpen(false);
              window.scrollTo({top: 0, behavior: 'smooth'});
            }} 
          />
        )}
        <SidebarLink icon={<Pencil size={20}/>} label="Edit Meme" onClick={() => { setIsSidebarOpen(false); setIsEditorModalOpen(true); }} />
        <SidebarLink 
          icon={<Upload size={20}/>} 
          label="Upload Meme" 
          onClick={() => { 
            setIsSidebarOpen(false); 
            user ? setIsUploadModalOpen(true) : setIsLoginModalOpen(true); 
          }} 
        />
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-2">
              <img 
                src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                alt="avatar" 
                className="w-10 h-10 rounded-full border border-violet-500/50" 
              />
              <div className="overflow-hidden">
                <p className="font-bold truncate">
                  {user.user_metadata?.username || user.email.split('@')[0]}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <SidebarLink icon={<LogOut size={20}/>} label="Log Out" onClick={() => { setIsSidebarOpen(false); handleLogout(); }} />
          </div>
        ) : (
          <SidebarLink icon={<LogIn size={20}/>} label="Sign In" onClick={() => { setIsSidebarOpen(false); setIsLoginModalOpen(true); }} />
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex">
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block fixed top-0 left-0 z-30 h-screen w-64 bg-[#0d1220] border-r border-white/10 p-6 shadow-2xl overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 z-[51] h-screen w-[80%] bg-[#0d1220] border-r border-white/10 p-6 shadow-2xl sm:w-64 lg:hidden overflow-y-auto"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:pl-64 min-w-0">
        <div className="relative isolate overflow-x-clip">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070B14]/95 backdrop-blur-xl transition-all">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-white/5 lg:hidden"
              >
                <Menu size={24} />
              </button>
              <img src={logo} alt="Meme Hub Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              <div className="hidden xs:block">
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Meme Finder</p>
                <h1 className="text-lg font-semibold sm:text-xl">Discover & Create</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!user && (
                <button onClick={() => setIsLoginModalOpen(true)} className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  <LogIn size={18} />
                  Sign In
                </button>
              )}
              <button
                onClick={handleRandomMeme}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:scale-105 active:scale-95"
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">Get Random Meme</span>
                <span className="sm:hidden">Random</span>
              </button>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-zinc-300">
                <span className="hidden xs:inline">Favorites: </span>{favorites.length}
              </div>
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
                <h2 className="text-2xl font-bold sm:text-3xl">
                  {viewMode === "uploads" ? "My Uploaded Memes" : "Meme Results"}
                </h2>
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
              onOpen={openMeme}
              toggleFavorite={toggleFavorite}
              favorites={favorites}
              setSearch={setSearch}
            />
          </section>

          {/* Default Bottom Editor */}
          <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <h2 className="mb-6 text-2xl font-bold sm:text-3xl flex items-center gap-3">
              <Pencil className="text-violet-400" /> Create Your Meme 😎
            </h2>
            <MemeEditor />
          </section>
        </main>

        <Footer />

        {/* Editor Popup Modal */}
        <AnimatePresence>
          {isEditorModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditorModalOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-5xl bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Meme Editor</h2>
                  <button onClick={() => setIsEditorModalOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><X size={20}/></button>
                </div>
                <MemeEditor />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Upload Popup Modal */}
        <AnimatePresence>
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsUploadModalOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Upload Meme 📤</h2>
                  <button onClick={() => setIsUploadModalOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><X size={20}/></button>
                </div>
                <UploadMeme onUpload={handleUploadMeme} onSuccess={() => setIsUploadModalOpen(false)} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
          onLogin={handleLogin} 
        />

        <MemeModal
          meme={activeMeme}
          onClose={closeModal}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
          onNext={handleRandomMeme}
        />
        </div>
      </div>
    </div>
  );
}
