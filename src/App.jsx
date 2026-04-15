import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";

import logo from "../meme-logo.png";
import { 
  Sparkles, 
  Menu, 
  X, 
  Download,
  Home, 
  Search, 
  Dices, 
  Pencil, 
  Upload, 
  LogIn, 
  LogOut, 
  Image, 
  Bookmark,
  Heart, 
  User as UserIcon, 
  ChevronRight, 
  ArrowLeft,
  KeyRound, 
  CheckCircle2, 
  Loader2, 
  Trophy, 
  Award,
  HelpCircle
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import CategoryFilter from "./components/CategoryFilter";
import AvatarPicker from "./components/AvatarPicker";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import MemeGrid from "./components/MemeGrid";
import SearchBar from "./components/SearchBar";
import { memes } from "./data/memes";
import { categories, smartSearch, suggestions } from "./utils/helpers";
import { getAllOwnerLikeCounts, getOwnerLikedMemeIdsForUser } from "./utils/likes";
import {
  DEFAULT_AVATAR_ID,
  getAvatarChoiceFromMetadata,
  getAvatarUrlById,
  resolveUserAvatar,
} from "./utils/avatarOptions";
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
    isDatabaseMeme: Boolean(m.image_url || m.created_at || m.user_id),
  };
};  

// Badge helper logic
const getBadge = (pts) => {
  if (pts >= 1000) return { name: "Legend", color: "text-amber-400", bg: "bg-amber-400/10" };
  if (pts >= 500) return { name: "Meme Pro", color: "text-violet-400", bg: "bg-violet-400/10" };
  if (pts >= 100) return { name: "Rookie", color: "text-emerald-400", bg: "bg-emerald-400/10" };
  return { name: "Newcomer", color: "text-zinc-500", bg: "bg-zinc-500/10" };
};

const SEMANTIC_MIN_QUERY_LENGTH = 2;
const SEMANTIC_DEBOUNCE_MS = 450;
const SEMANTIC_API_URL = import.meta.env.VITE_SEMANTIC_API_URL || "/api/semantic-search";

export default function App() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [dbLikeCounts, setDbLikeCounts] = useState({});
  const [ownerLikeCounts, setOwnerLikeCounts] = useState(getAllOwnerLikeCounts);
  const [likedMemeIds, setLikedMemeIds] = useState([]);
  const [semanticMemes, setSemanticMemes] = useState([]);
  const [semanticStatus, setSemanticStatus] = useState("idle");
  const [semanticError, setSemanticError] = useState("");
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [dismissInstallBanner, setDismissInstallBanner] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const path = window.location.pathname;
  const isOverlayOpen = Boolean(
    isSidebarOpen ||
      activeMeme ||
      isEditorModalOpen ||
      isUploadModalOpen ||
      isLoginModalOpen ||
      isHelpOpen ||
      isLogoutConfirmOpen ||
      isResetConfirmOpen ||
      isAvatarModalOpen ||
      notification ||
      resetStatus ||
      showIosInstallModal
  );
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

  // Lock page scroll whenever any overlay is open
  useEffect(() => {
    document.body.style.overflow = isOverlayOpen ? "hidden" : "unset";
    document.documentElement.style.overflow = isOverlayOpen ? "hidden" : "unset";

    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const detectStandalone = () => media.matches || window.navigator.standalone === true;
    const updateStandaloneMode = () => setIsStandaloneMode(detectStandalone());

    updateStandaloneMode();

    const userAgent = window.navigator.userAgent || "";
    const isIos = /iphone|ipad|ipod/i.test(userAgent);
    const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opr\//i.test(userAgent);
    setShowIosInstallHint(isIos && isSafari && !detectStandalone());

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      setIsInstallable(true);
    };

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsInstallable(false);
      setDismissInstallBanner(true);
      setIsStandaloneMode(true);
    };

    if (media.addEventListener) media.addEventListener("change", updateStandaloneMode);
    else media.addListener(updateStandaloneMode);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      if (media.removeEventListener) media.removeEventListener("change", updateStandaloneMode);
      else media.removeListener(updateStandaloneMode);

      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    const fetchLikeCounts = async () => {
      const { data, error } = await supabase.from("likes").select("meme_id");

      if (error) {
        console.error("Error fetching likes:", error);
        return;
      }

      const counts = data.reduce((acc, row) => {
        const key = String(row.meme_id);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      setDbLikeCounts(counts);
      setOwnerLikeCounts(getAllOwnerLikeCounts());
    };

    fetchLikeCounts();

    const channel = supabase
      .channel("global-like-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
        },
        fetchLikeCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLikedMemeIds([]);
      return;
    }

    const fetchUserLikedMemeIds = async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("meme_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user likes:", error);
        setLikedMemeIds(getOwnerLikedMemeIdsForUser(user.id));
        return;
      }

      const dbIds = (data || []).map((row) => String(row.meme_id));
      const ownerIds = getOwnerLikedMemeIdsForUser(user.id);
      setLikedMemeIds([...new Set([...dbIds, ...ownerIds])]);
    };

    fetchUserLikedMemeIds();

    const channel = supabase
      .channel(`user-liked-memes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
          filter: `user_id=eq.${user.id}`,
        },
        fetchUserLikedMemeIds
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEMANTIC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (viewMode !== "all" || debouncedSearch.length < SEMANTIC_MIN_QUERY_LENGTH) {
      setSemanticMemes([]);
      setSemanticStatus("idle");
      setSemanticError("");
      return;
    }

    let isCancelled = false;
    setSemanticStatus("searching");
    setSemanticError("");

    const runSemanticSearch = async () => {
      try {
        const res = await fetch(SEMANTIC_API_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: debouncedSearch,
            limit: 24,
            category: selectedCategory,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : {};
        if (!res.ok) {
          throw new Error(
            payload?.error || `Semantic endpoint returned ${res.status}. Check API deployment/env.`
          );
        }

        if (isCancelled) return;

        const normalized = (payload?.results || []).map((meme) =>
          normalizeMeme(
            {
              ...meme,
              profiles: meme?.profiles || (meme?.username ? { username: meme.username } : null),
            },
            user?.id
          )
        );

        setSemanticMemes(normalized);
        setSemanticStatus(payload?.source === "semantic" ? "semantic" : "fallback");
        setSemanticError(payload?.source === "fallback" ? payload?.reason || "" : "");
      } catch (error) {
        if (isCancelled) return;
        setSemanticMemes([]);
        setSemanticStatus("fallback");
        setSemanticError(error.message || "AI search unavailable, using keyword fallback.");
      }
    };

    runSemanticSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearch, selectedCategory, user?.id, viewMode]);

  const allMemesNormalized = useMemo(() => {
    return [...dbMemes, ...memes].map(m => normalizeMeme(m, user?.id));
  }, [dbMemes, user?.id]);

  const searchPlaceholderTitles = useMemo(() => {
    const seen = new Set();

    return allMemesNormalized
      .map((meme) => (typeof meme.title === "string" ? meme.title.trim() : ""))
      .filter((title) => {
        if (!title) return false;

        const normalizedTitle = title.toLowerCase();
        if (seen.has(normalizedTitle)) return false;

        seen.add(normalizedTitle);
        return true;
      });
  }, [allMemesNormalized]);

  const allLikeCounts = useMemo(
    () => ({ ...dbLikeCounts, ...ownerLikeCounts }),
    [dbLikeCounts, ownerLikeCounts]
  );
  const likedMemeIdSet = useMemo(
    () => new Set((likedMemeIds || []).map((id) => String(id))),
    [likedMemeIds]
  );

  const handleLikeCountChange = useCallback((memeId, count, isOwnerUpload = false) => {
    const key = String(memeId);
    const safeCount = Math.max(0, Number(count) || 0);

    if (isOwnerUpload) {
      setOwnerLikeCounts((prev) => ({ ...prev, [key]: safeCount }));
      return;
    }

    setDbLikeCounts((prev) => ({ ...prev, [key]: safeCount }));
  }, []);

  const handleLikeStateChange = useCallback((memeId, isLiked) => {
    const key = String(memeId);
    setLikedMemeIds((prev) => {
      const next = new Set((prev || []).map((id) => String(id)));
      if (isLiked) next.add(key);
      else next.delete(key);
      return [...next];
    });
  }, []);

  const filteredMemes = useMemo(() => {
    let baseList = allMemesNormalized;
    
    if (viewMode === "uploads" && user) {
      baseList = baseList.filter(m => m.user_id === user.id);
    } else if (viewMode === "favorites") {
      baseList = baseList.filter(m => favorites.includes(m.id));
    } else if (viewMode === "liked") {
      baseList = baseList.filter((m) => likedMemeIdSet.has(String(m.id)));
    }

    const searchedMemes = smartSearch(baseList, search, selectedCategory);

    const shouldUseSemanticSearch =
      viewMode === "all" && debouncedSearch.length >= SEMANTIC_MIN_QUERY_LENGTH;

    let mergedResults = searchedMemes;

    if (shouldUseSemanticSearch && semanticMemes.length > 0) {
      const localOwnerMatches = smartSearch(
        baseList.filter((meme) => !meme.user_id),
        search,
        selectedCategory
      );

      const seenIds = new Set();
      mergedResults = [...semanticMemes, ...localOwnerMatches].filter((meme) => {
        const key = String(meme.id);
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      });
    }

    if (shouldUseSemanticSearch && semanticMemes.length > 0) {
      return [...mergedResults].sort((a, b) => {
        const similarityA = typeof a.similarity === "number" ? a.similarity : -1;
        const similarityB = typeof b.similarity === "number" ? b.similarity : -1;
        if (similarityB !== similarityA) return similarityB - similarityA;

        return (allLikeCounts[String(b.id)] || 0) - (allLikeCounts[String(a.id)] || 0) || (new Date(b.created_at || 0) - new Date(a.created_at || 0));
      });
    }

    // Optimized Sorting: Most Liked Memes always on top
    const sorted = [...mergedResults].sort((a, b) => {
      const likeDiff = (allLikeCounts[String(b.id)] || 0) - (allLikeCounts[String(a.id)] || 0);
      if (likeDiff !== 0) return likeDiff;

      const createdDiff =
        (new Date(b.created_at || 0).getTime() || 0) -
        (new Date(a.created_at || 0).getTime() || 0);
      if (createdDiff !== 0) return createdDiff;

      return 0;
    });
    return sorted;
  }, [
    allMemesNormalized,
    search,
    debouncedSearch,
    selectedCategory,
    viewMode,
    user,
    favorites,
    allLikeCounts,
    likedMemeIdSet,
    semanticMemes,
  ]);

  const currentAvatarId = getAvatarChoiceFromMetadata(user?.user_metadata);
  const currentAvatarUrl = resolveUserAvatar(user);
  const hasPendingAvatarChange = selectedAvatarId !== currentAvatarId;

  const openAvatarModal = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    setSelectedAvatarId(currentAvatarId);
    setIsAvatarModalOpen(true);
  };

  const closeAvatarModal = () => {
    setSelectedAvatarId(currentAvatarId);
    setIsAvatarModalOpen(false);
  };

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
    setSelectedAvatarId(getAvatarChoiceFromMetadata(user?.user_metadata));
  }, [user]);

  useEffect(() => {
    // Handle initial session check
    // Listen for auth state changes (login, logout, magic link success)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (event === "INITIAL_SESSION" && session?.user) {
          fetchProfile(session.user.id, session.user);
        }

        if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") {
          setIsLoginModalOpen(false);
          if (session?.user) fetchProfile(session.user.id, session.user);
        } else if (event === "SIGNED_OUT") {
          setProfile(null);
          setIsAvatarModalOpen(false);
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

  const handleInstallApp = async () => {
    if (isInstallable && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setDismissInstallBanner(true);
      }
      setDeferredInstallPrompt(null);
      setIsInstallable(false);
      return;
    }

    if (showIosInstallHint) {
      setShowIosInstallModal(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAvatarModalOpen(false);
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

  const handleAvatarSave = async () => {
    if (!user || !hasPendingAvatarChange) return;

    setIsSavingAvatar(true);

    const nextAvatarUrl = getAvatarUrlById(selectedAvatarId);
    const nextMetadata = {
      ...user.user_metadata,
      avatar_choice: selectedAvatarId,
      avatar_url: nextAvatarUrl,
    };

    const { error } = await supabase.auth.updateUser({
      data: nextMetadata,
    });

    if (error) {
      setNotification({
        type: "error",
        message: error.message || "We could not update your avatar right now.",
      });
      setIsSavingAvatar(false);
      return;
    }

    const { data: userData, error: refreshError } = await supabase.auth.getUser();

    if (refreshError) {
      console.warn("Could not refresh user after avatar update:", refreshError.message);
    }

    setUser(
      userData?.user || {
        ...user,
        user_metadata: nextMetadata,
      }
    );
    setNotification({
      type: "success",
      message: "Your avatar has been updated.",
    });
    setIsAvatarModalOpen(false);
    setIsSavingAvatar(false);
  };

  const handleUploadMeme = (meme) => {
    setDbMemes((prev) => [normalizeMeme(meme, user?.id), ...prev]);
    if (meme?.id !== undefined && meme?.id !== null) {
      setDbLikeCounts((prev) => ({ ...prev, [String(meme.id)]: prev[String(meme.id)] || 0 }));
    }
    if (user) fetchProfile(user.id, user); // Refresh points immediately
  };

  useEffect(() => {
    const fetchMemes = async () => {
      const { data, error } = await supabase
        .from("meme-table")
        .select("*, profiles(username)")
        .order("created_at", { ascending: false });

      if (error) return console.error("Error fetching memes:", error);

      const formatted = data.map((m) => normalizeMeme(m));
      setDbMemes(formatted);
    };

    fetchMemes();
  }, []);

  if (path === "/reset-password") {
    return <ResetPassword user={user} />;
  }

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
              icon={<Bookmark size={20}/>} 
              label="Bookmarks" 
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
        <div className="my-2 border-t border-white/10" />
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
                src={currentAvatarUrl} 
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
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:flex lg:items-center lg:justify-between">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-white/5 lg:hidden"
                  >
                    <Menu size={24} />
                  </button>
                  <img src={logo} alt="RoastRiot Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" />
                  <div className="hidden xs:block min-w-0">
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Meme Finder</p>
                    <h1 className="text-base font-semibold sm:text-xl truncate">Discover & Create</h1>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 lg:mt-0 lg:overflow-visible lg:pb-0">
                {profile && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white/5 border border-white/10 rounded-2xl shrink-0">
                    <Award size={14} className="text-violet-400 sm:w-4 sm:h-4" />
                    <span className="text-[10px] sm:text-sm font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      {profile.points} pts
                    </span>
                  </div>
                )}
                {!user && (
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 rounded-full text-xs sm:text-sm font-semibold"
                  >
                    Login
                  </button>
                )}
                <button
                  onClick={handleRandomMeme}
                  className="shrink-0 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:scale-105 active:scale-95"
                >
                  <Sparkles size={16} />
                  <span className="hidden sm:inline">Get Random Meme</span>
                  <span className="sm:hidden">Random</span>
                </button>
                {!isStandaloneMode && (isInstallable || showIosInstallHint) && (
                  <button
                    onClick={handleInstallApp}
                    className="shrink-0 flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20"
                  >
                    <Download size={16} />
                    <span className="hidden sm:inline">Install App</span>
                  </button>
                )}
                <button
                  onClick={() => { setViewMode(viewMode === "favorites" ? "all" : "favorites"); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                  className={`shrink-0 flex items-center gap-2 rounded-full border px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm transition-all ${
                    viewMode === "favorites" 
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300" 
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  <Bookmark size={16} className={viewMode === "favorites" ? "fill-violet-400" : ""} />
                  <span className="hidden xs:inline">Bookmarks: </span>{favorites.length}
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
              <div className="mb-6 text-left">
                <button
                  onClick={() => setViewMode("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </div>
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
            </motion.section>
          ) : viewMode === "profile" && user ? (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 max-w-2xl mx-auto p-6 sm:p-10 bg-[#0d1220] border border-white/10 rounded-[2.5rem] shadow-2xl"
            >
              <div className="mb-6">
                <button
                  onClick={() => setViewMode("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 p-1">
                  <img 
                    src={currentAvatarUrl} 
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setViewMode("liked");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Heart size={18} className="text-pink-400" />
                        <span className="font-semibold">Liked Memes</span>
                      </div>
                      <span className="text-sm font-bold text-pink-400">{likedMemeIds.length}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">See all memes you liked</p>
                  </button>

                  <button
                    onClick={() => {
                      setViewMode("favorites");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Bookmark size={18} className="text-violet-400" />
                        <span className="font-semibold">Bookmarked Memes</span>
                      </div>
                      <span className="text-sm font-bold text-violet-400">{favorites.length}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Open your saved bookmarks</p>
                  </button>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Image size={18} className="text-violet-400" />
                        <h3 className="font-semibold">Profile Avatar</h3>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Pick the avatar shown in your profile, sidebar, and future sessions.
                      </p>
                    </div>
                    <button
                      onClick={openAvatarModal}
                      className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition hover:scale-[1.02]"
                    >
                      Change Avatar
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111827]/60 p-3">
                    <img
                      src={currentAvatarUrl}
                      alt="Current avatar preview"
                      className="h-14 w-14 rounded-full border border-violet-400/30 bg-[#0d1220] object-cover"
                    />
                    <div>
                      <p className="font-semibold text-white">Current avatar</p>
                      <p className="text-xs text-zinc-500">Click Change Avatar to view all avatar styles.</p>
                    </div>
                  </div>
                </div>

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
                <SearchBar
                  search={search}
                  setSearch={setSearch}
                  placeholderTitles={searchPlaceholderTitles}
                />
                <CategoryFilter categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
              </section>

              <section className="mt-10">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold sm:text-3xl">
                      {viewMode === "uploads"
                        ? "My Uploaded Memes"
                        : viewMode === "favorites"
                        ? "My Bookmarked Memes"
                        : viewMode === "liked"
                        ? "My Liked Memes"
                        : "Meme Results"}
                    </h2>
                    <p className="text-zinc-400">
                      {filteredMemes.length} meme{filteredMemes.length === 1 ? "" : "s"} found
                    </p>
                    {viewMode === "all" && debouncedSearch.length >= SEMANTIC_MIN_QUERY_LENGTH ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {semanticStatus === "searching"
                          ? "Understanding your intent..."
                          : semanticStatus === "semantic"
                          ? "AI semantic search active"
                          : semanticStatus === "fallback"
                          ? "Keyword fallback active"
                          : semanticStatus === "failed"
                          ? "AI search unavailable, showing keyword results"
                          : null}
                      </p>
                    ) : null}
                    {semanticError && semanticStatus !== "searching" ? (
                      <p className="mt-1 text-[11px] text-amber-300/80">{semanticError}</p>
                    ) : null}
                  </div>

                  {search ? (
                    <button onClick={() => setSearch("")} className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 transition hover:bg-white/10">
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
                  user={user}
                  likeCounts={allLikeCounts}
                  onLikeCountChange={handleLikeCountChange}
                  onLikeStateChange={handleLikeStateChange}
                />
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
                <div className="flex items-center justify-between mb-6 gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsEditorModalOpen(false)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                    <h2 className="text-2xl font-bold">Meme Editor</h2>
                  </div>
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

        {/* Avatar Picker Modal */}
        <AnimatePresence>
          {isAvatarModalOpen && user && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 lg:pl-64">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeAvatarModal}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-3xl rounded-[2.5rem] border border-white/10 bg-[#0d1220] p-6 shadow-2xl sm:p-8"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Change Avatar</h2>
                    <p className="mt-1 text-xs text-zinc-500">Select your look, then save it.</p>
                  </div>
                  <button onClick={closeAvatarModal} className="rounded-full bg-white/5 p-2 hover:bg-white/10">
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111827]/60 p-3">
                  <img
                    src={getAvatarUrlById(selectedAvatarId)}
                    alt="Selected avatar preview"
                    className="h-14 w-14 rounded-full border border-violet-400/30 bg-[#0d1220] object-cover"
                  />
                  <div>
                    <p className="font-semibold text-white">Selected avatar preview</p>
                    <p className="text-xs text-zinc-500">This avatar will appear across your account.</p>
                  </div>
                </div>

                <AvatarPicker
                  selectedAvatarId={selectedAvatarId}
                  onSelect={setSelectedAvatarId}
                  disabled={isSavingAvatar}
                  className="max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar"
                />

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={closeAvatarModal}
                    disabled={isSavingAvatar}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAvatarSave}
                    disabled={isSavingAvatar || !hasPendingAvatarChange}
                    className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingAvatar ? "Saving..." : hasPendingAvatarChange ? "Save Avatar" : "Avatar Saved"}
                  </button>
                </div>
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

      <AnimatePresence>
        {!isStandaloneMode && !dismissInstallBanner && (isInstallable || showIosInstallHint) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-[140] rounded-3xl border border-violet-500/30 bg-[#0d1220]/95 p-4 shadow-2xl backdrop-blur-xl lg:left-auto lg:right-6 lg:w-[420px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-violet-300">Install RoastRiot.meme</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {isInstallable
                    ? "Install this app for a faster, standalone meme experience."
                    : "On iPhone: tap Share, then Add to Home Screen."}
                </p>
              </div>
              <button
                onClick={() => setDismissInstallBanner(true)}
                className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss install banner"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleInstallApp}
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white transition hover:scale-[1.02]"
              >
                {isInstallable ? "Install now" : "Show steps"}
              </button>
              <button
                onClick={() => setDismissInstallBanner(true)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosInstallModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 lg:pl-64">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIosInstallModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0d1220] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold">Install on iPhone</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
                <li>Tap the Share button in Safari.</li>
                <li>Select Add to Home Screen.</li>
                <li>Tap Add to install RoastRiot.meme.</li>
              </ol>
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 text-sm font-bold text-white"
              >
                Got it
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
            likeCounts={allLikeCounts}
            onLikeCountChange={handleLikeCountChange}
            onLikeStateChange={handleLikeStateChange}
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
