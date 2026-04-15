import { useEffect, useMemo, useState, lazy, Suspense } from "react";

import logo from "../meme-logo.png";
import { 
  Sparkles, 
  Menu, 
  X, 
  Home, 
  Search, 
  Dices, 
  Pencil, 
  Upload, 
  LogIn, 
  LogOut, 
  Image, 
  Heart, 
  User as UserIcon, 
  ChevronRight, 
  KeyRound, 
  CheckCircle2, 
  Loader2, 
  Trophy, 
  Award,
  HelpCircle
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import CategoryFilter from "./components/CategoryFilter";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import MemeGrid from "./components/MemeGrid";
import SearchBar from "./components/SearchBar";
import { memes } from "./data/memes";
import { categories, smartSearch, suggestions } from "./utils/helpers";
import { supabase } from "./lib/supabase";

// Lazy load heavy components
const MemeModal = lazy(() => import("./components/MemeModal"));
const UploadMeme = lazy(() => import("./components/UploadMeme"));
const MemeEditor = lazy(() => import("./components/MemeEditor"));
const LoginModal = lazy(() => import("./components/LoginModal"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const HelpModal = lazy(() => import("./components/HelpModal"));

function getInitialFavorites() {
  try {
    const savedFavorites = localStorage.getItem("favorite-memes");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  } catch {
    return [];
  }
}

// Helper to ensure data from any source matches the component expectations
const normalizeMeme = (m, currentUserId) => {
  const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  
  return {
    ...m,
    // Fix brackets in category/mood and handle array types from DB
    category: Array.isArray(m.category) 
      ? m.category[0] 
      : (typeof m.category === 'string' ? m.category.replace(/[\[\]"']/g, '').trim() : m.category),
    mood: Array.isArray(m.mood) 
      ? m.mood[0] 
      : (typeof m.mood === 'string' ? m.mood.replace(/[\[\]"']/g, '').trim() : m.mood),
    // Ensure keywords is always a clean array
    keywords: Array.isArray(m.keywords) 
      ? m.keywords 
      : (typeof m.keywords === 'string' ? m.keywords.replace(/[\[\]"']/g, '').split(/[\s,]+/).filter(Boolean) : []),
    username: m.user_id 
      ? (currentUserId && m.user_id === currentUserId ? "You" : (profileData?.username || "User"))
      : "Owner",
    image: m.image_url || m.image || "",
  };
};  

// Badge helper logic
const getBadge = (pts) => {
  if (pts >= 1000) return { name: "Legend", color: "text-amber-400", bg: "bg-amber-400/10" };
  if (pts >= 500) return { name: "Meme Pro", color: "text-violet-400", bg: "bg-violet-400/10" };
  if (pts >= 100) return { name: "Rookie", color: "text-emerald-400", bg: "bg-emerald-400/10" };
  return { name: "Newcomer", color: "text-zinc-500", bg: "bg-zinc-500/10" };
};

export default function App() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeMeme, setActiveMeme] = useState(null);
  const [favorites, setFavorites] = useState(getInitialFavorites);
 const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [dbMemes, setDbMemes] = useState([]);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }
  const [resetStatus, setResetStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
const path = window.location.pathname;
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

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen]);

  const allMemesNormalized = useMemo(() => {
    return [...dbMemes, ...memes].map(m => normalizeMeme(m, user?.id));
  }, [dbMemes, user?.id]);

  const filteredMemes = useMemo(() => {
    let baseList = allMemesNormalized;
    
    if (viewMode === "uploads" && user) {
      baseList = baseList.filter(m => m.user_id === user.id);
    } else if (viewMode === "favorites") {
      baseList = baseList.filter(m => favorites.includes(m.id));
    }
    
    return smartSearch(baseList, search, selectedCategory);
  }, [allMemesNormalized, search, selectedCategory, viewMode, user, favorites]);

  const fetchProfile = async (userId, userData) => {
    // Use maybeSingle to check if profile exists
    let { data, error } = await supabase
      .from("profiles")
      .select("id, username, points")
      .eq("id", userId)
      .maybeSingle();

    if (!error && !data) {
      // Profile doesn't exist, create it (Profile Guard for Magic Links/New Users)
      const username = userData?.user_metadata?.username || userData?.email?.split('@')[0] || "User";
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .upsert({ 
          id: userId, 
          username: username,
          points: 0 
        }, { onConflict: 'id' })
        .select()
        .maybeSingle();
      
      if (!createError && newProfile) setProfile(newProfile);
    } else if (!error && data) {
      setProfile(data);
    }
  };

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, points")
      .order("points", { ascending: false })
      .limit(5);
    if (!error) setLeaderboard(data);
  };

  function toggleFavorite(id) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

useEffect(() => {
  // Handle initial session check
  // Listen for auth state changes (login, logout, magic link success)
  const { data: listener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setUser(session?.user ?? null);
      
      if (event === "INITIAL_SESSION" && session?.user) {
        fetchProfile(session.user.id, session.user);
      }

      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        setIsLoginModalOpen(false);
        if (session?.user) fetchProfile(session.user.id, session.user);
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    }
  );

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);
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
    if (allMemesNormalized.length === 0) return;
    const randomIndex = Math.floor(Math.random() * allMemesNormalized.length);
    openMeme(allMemesNormalized[randomIndex]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setViewMode("all");
  };

  const handlePasswordResetRequest = async () => {
    if (!user?.email) return;
    setIsResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setIsResetLoading(false);
    setIsResetConfirmOpen(false);
    if (error) setResetStatus({ type: 'error', message: error.message });
    else setResetStatus({ type: 'success', message: "A password reset link has been sent to your email! Please check your inbox. 📧" });
  };

  const handleUploadMeme = (meme) => {
    setDbMemes((prev) => [normalizeMeme(meme, user?.id), ...prev]);
    if (user) fetchProfile(user.id, user); // Refresh points immediately
  };
if (path === "/reset-password") {
  return <ResetPassword user={user} />;
}
  useEffect(() => {
    fetchMemes();
  }, []);

  const fetchMemes = async () => {
    const { data, error } = await supabase
      .from("meme-table")
      .select("*, profiles(username)")
      .order("created_at", { ascending: false });

    if (error) return console.error("Error fetching memes:", error);

    const formatted = data.map(m => normalizeMeme(m, user?.id));
    setDbMemes(formatted);
  };
  const SidebarContent = () => (
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      <div className="flex items-center justify-between mb-6 sm:mb-10 flex-shrink-0">
        <div className="font-black text-xl tracking-tighter bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          RoastRiot.meme
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-full text-zinc-500">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1 min-h-0">
        <SidebarLink icon={<Home size={20}/>} label="Memes" onClick={() => { setViewMode("all"); setIsSidebarOpen(false); window.scrollTo({top: 0, behavior: 'smooth'}); }} />
        <SidebarLink icon={<Trophy size={20}/>} label="Leaderboard" onClick={() => { setViewMode("leaderboard"); fetchLeaderboard(); setIsSidebarOpen(false); window.scrollTo({top: 0, behavior: 'smooth'}); }} />
        <SidebarLink icon={<Search size={20}/>} label="Search" onClick={() => { setIsSidebarOpen(false); document.querySelector('input[type="text"]')?.focus(); }} />
        {user && (
          <>
            <SidebarLink 
              icon={<Image size={20}/>} 
              label="My Uploads" 
              onClick={() => { 
                setViewMode("uploads");
                setIsSidebarOpen(false);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }} 
            />
            <SidebarLink 
              icon={<Heart size={20}/>} 
              label="Favorites" 
              onClick={() => { 
                setViewMode("favorites");
                setIsSidebarOpen(false);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }} 
            />
          </>
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
        <SidebarLink 
          icon={<HelpCircle size={20}/>} 
          label="How to Use" 
          onClick={() => { setIsSidebarOpen(false); setIsHelpOpen(true); }} 
        />
      </nav>

      <div className="pt-3 sm:pt-6 border-t border-white/10 mt-2 sm:mt-6 flex-shrink-0">
        {user ? (
          <div className="space-y-2 sm:space-y-4">
            <button 
              onClick={() => { 
                setViewMode("profile");
                setIsSidebarOpen(false);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              className="flex items-center gap-3 p-2 w-full text-left hover:bg-white/5 rounded-xl transition-colors group"
            >
              <img 
                src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                alt="avatar"
                className="w-10 h-10 rounded-full border border-violet-500/50 group-hover:scale-105 transition-transform" 
              />
              <div className="overflow-hidden">
                <p className="font-bold truncate group-hover:text-violet-400 transition-colors">
                  {profile?.username || user.user_metadata?.username || user.email.split('@')[0]}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </button>
            <SidebarLink icon={<LogOut size={20}/>} label="Log Out" onClick={() => { setIsSidebarOpen(false); setIsLogoutConfirmOpen(true); }} />
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
              className="fixed top-0 left-0 z-[51] h-[100dvh] w-[80%] bg-[#0d1220] border-r border-white/10 p-4 sm:p-6 shadow-2xl sm:w-64 lg:hidden"
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
              <img src={logo} alt="RoastRiot Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              <div className="hidden xs:block">
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Meme Finder</p>
                <h1 className="text-lg font-semibold sm:text-xl">Discover & Create</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {profile && (
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white/5 border border-white/10 rounded-2xl">
                  <Award size={14} className="text-violet-400 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-sm font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {profile.points} pts
                  </span>
                </div>
              )}
              {!user && (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-4 py-2 bg-purple-600 rounded"
                >
                  Login
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
              <button
                onClick={() => { setViewMode(viewMode === "favorites" ? "all" : "favorites"); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm transition-all ${
                  viewMode === "favorites" 
                    ? "border-pink-500/50 bg-pink-500/10 text-pink-400" 
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                <Heart size={16} className={viewMode === "favorites" ? "fill-pink-500" : ""} />
                <span className="hidden xs:inline">Favorites: </span>{favorites.length}
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          {viewMode === "leaderboard" ? (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 max-w-2xl mx-auto p-6 sm:p-10 bg-[#0d1220] border border-white/10 rounded-[2.5rem] shadow-2xl text-center"
            >
              <Trophy size={48} className="mx-auto mb-4 text-amber-400" />
              <h2 className="text-3xl font-black mb-2">Meme Hall of Fame</h2>
              <p className="text-zinc-500 mb-8">Top contributors in the RoastRiot community</p>
              
              <div className="space-y-3">
                {leaderboard.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-amber-400 text-black' : 
                        idx === 1 ? 'bg-zinc-300 text-black' : 
                        idx === 2 ? 'bg-amber-700 text-white' : 'text-zinc-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold">{player.username}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getBadge(player.points).bg} ${getBadge(player.points).color}`}>
                        {getBadge(player.points).name}
                      </span>
                    </div>
                    <span className="font-black text-violet-400">{player.points} pts</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setViewMode("all")} className="mt-8 text-zinc-500 hover:text-white transition-colors text-sm">
                Back to memes
              </button>
            </motion.section>
          ) : viewMode === "profile" && user ? (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 max-w-2xl mx-auto p-6 sm:p-10 bg-[#0d1220] border border-white/10 rounded-[2.5rem] shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 p-1">
                  <img 
                    src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                    alt="Profile" 
                    className="w-full h-full rounded-full bg-[#0d1220] object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold">{profile?.username || user.user_metadata?.username || 'Meme Creator'}</h2>
                  <p className="text-zinc-500">{user.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${getBadge(profile?.points || 0).bg} ${getBadge(profile?.points || 0).color}`}>
                      {getBadge(profile?.points || 0).name} • {profile?.points || 0} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                      <LogIn size={18} />
                    </div>
                    <span className="font-semibold">Request Password Reset Email</span>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>

                <button 
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className="w-full p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                      <LogOut size={18} />
                    </div>
                    <span className="font-semibold text-red-400">Log Out Session</span>
                  </div>
                  <ChevronRight size={18} className="text-red-900 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </motion.section>
          ) : (
            <>
              <Hero />
              <section className="-mt-16 relative z-20 rounded-[2rem] border border-white/10 bg-[#0d1220] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
                <SearchBar search={search} setSearch={setSearch} />
                <CategoryFilter categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
              </section>

              <section className="mt-10">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold sm:text-3xl">
                      {viewMode === "uploads" ? "My Uploaded Memes" : viewMode === "favorites" ? "My Favorite Memes" : "Meme Results"}
                    </h2>
                    <p className="text-zinc-400">
                      {filteredMemes.length} meme{filteredMemes.length === 1 ? "" : "s"} found
                    </p>
                  </div>

                  {search ? (
                    <button onClick={() => setSearch("")} className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 transition hover:bg-white/10">
                      Clear search
                    </button>
                  ) : null}
                </div>
                <MemeGrid memes={filteredMemes} onOpen={openMeme} toggleFavorite={toggleFavorite} favorites={favorites} setSearch={setSearch} />
              </section>
            </>
          )}

          {/* Default Bottom Editor */}
          <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <h2 className="mb-6 text-2xl font-bold sm:text-3xl flex items-center gap-3">
              <Pencil className="text-violet-400" /> Create Your Meme 😎
            </h2>
            <MemeEditor user={user} onUpload={handleUploadMeme} />
          </section>
        </main>

        <Footer />

        {/* Editor Popup Modal */}
        <AnimatePresence>
          {isEditorModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:pl-64">
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
                className="relative w-full max-w-5xl bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Meme Editor</h2>
                  <button onClick={() => setIsEditorModalOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><X size={20}/></button>
                </div>
                <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-violet-500" /></div>}>
                  <MemeEditor user={user} onUpload={handleUploadMeme} onSuccess={(msg) => { setIsEditorModalOpen(false); setNotification({ type: 'success', message: msg }); }} />
                </Suspense>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Upload Popup Modal */}
        <AnimatePresence>
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:pl-64">
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
                <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-violet-500" /></div>}>
                  <UploadMeme user={user} onUpload={handleUploadMeme} onSuccess={(msg) => { setIsUploadModalOpen(false); setNotification({ type: 'success', message: msg }); }} />
                </Suspense>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isLoginModalOpen && (
            <Suspense fallback={null}>
              <LoginModal 
                isOpen={isLoginModalOpen} 
                onClose={() => setIsLoginModalOpen(false)} 
              />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Logout Confirmation Modal */}
        <AnimatePresence>
          {isLogoutConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-64">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogoutConfirmOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d1220] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Logging out? 🚀</h3>
                <p className="text-zinc-400 mb-8">Are you sure you want to end your session? We'll miss the memes!</p>
                <div className="flex gap-3">
                  <button onClick={() => setIsLogoutConfirmOpen(false)} className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition font-semibold text-zinc-300">Cancel</button>
                  <button onClick={() => { setIsLogoutConfirmOpen(false); handleLogout(); }} className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 transition font-semibold text-white shadow-lg shadow-red-500/20">Sign Out</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Password Reset Confirmation Modal */}
        <AnimatePresence>
          {isResetConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-64">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsResetConfirmOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d1220] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-violet-500/10 text-violet-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Reset Password? 🔑</h3>
                <p className="text-zinc-400 mb-8">We'll send a secure link to your email to change your password.</p>
                <div className="flex gap-3">
                  <button disabled={isResetLoading} onClick={() => setIsResetConfirmOpen(false)} className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition font-semibold text-zinc-300 disabled:opacity-50">Cancel</button>
                  <button 
                    disabled={isResetLoading} 
                    onClick={handlePasswordResetRequest} 
                    className="flex-1 py-3 rounded-2xl bg-violet-500 hover:bg-violet-600 transition font-semibold text-white shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isResetLoading ? <Loader2 className="animate-spin" size={18} /> : null}
                    {isResetLoading ? "Sending..." : "Send Link"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Password Reset Result/Status Modal */}
      <AnimatePresence>
        {resetStatus && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 lg:pl-64">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetStatus(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d1220] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center z-10">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                resetStatus.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {resetStatus.type === 'success' ? <CheckCircle2 size={32} /> : <X size={32} />}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {resetStatus.type === 'success' ? 'Email Sent! 🚀' : 'Request Failed ❌'}
              </h3>
              <p className="text-zinc-400 mb-8">{resetStatus.message}</p>
              <button 
                onClick={() => setResetStatus(null)} 
                className="w-full py-3 rounded-2xl bg-violet-500 hover:bg-violet-600 transition font-semibold text-white shadow-lg shadow-violet-500/20"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success/Notification Popup Modal */}
      <AnimatePresence>
        {notification && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:pl-64">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setNotification(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d1220] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center z-10">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                notification.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {notification.type === 'success' ? <CheckCircle2 size={32} /> : <X size={32} />}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {notification.type === 'success' ? 'Success! 🚀' : 'Oops! ❌'}
              </h3>
              <p className="text-zinc-400 mb-8">{notification.message}</p>
              <button 
                onClick={() => setNotification(null)} 
                className="w-full py-3 rounded-2xl bg-violet-500 hover:bg-violet-600 transition font-semibold text-white shadow-lg shadow-violet-500/20"
              >
                Awesome!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        <Suspense fallback={null}>
          <MemeModal
            meme={activeMeme}
            user={user}
            onClose={closeModal}
            toggleFavorite={toggleFavorite}
            favorites={favorites}
            onNext={handleRandomMeme}
          />
        </Suspense>
        <Suspense fallback={null}>
          <HelpModal 
            isOpen={isHelpOpen} 
            onClose={() => setIsHelpOpen(false)} 
            user={user}
            onLoginClick={() => { setIsHelpOpen(false); setIsLoginModalOpen(true); }}
          />
        </Suspense>
        </div>
      </div>
    </div>
  );
}
