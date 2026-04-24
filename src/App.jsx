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
  ChevronDown,
  ArrowLeft,
  KeyRound, 
  CheckCircle2,
  Loader2,
  Trophy,
  Award,
  HelpCircle,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Clock3,
  Globe,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import CategoryFilter from "./components/CategoryFilter";
import AvatarPicker from "./components/AvatarPicker";
import AdminModeration from "./components/AdminModeration";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import Loader from "./components/Loader";
import MemeGrid from "./components/MemeGrid";
import NotificationBell from "./components/NotificationBell";
import MoodMemeSearchPage from "./components/MoodMemeSearchPage";
import RizzGeneratorSidebar from "./components/RizzGeneratorSidebar";
import ThemeSwitcher from "./components/ThemeSwitcher";
import SearchBar from "./components/SearchBar";
import { memes } from "./data/memes";
import { categories, smartSearch, suggestions } from "./utils/helpers";
import { getAllOwnerLikeCounts, getOwnerLikedMemeIdsForUser } from "./utils/likes";
import { prepareMemeDeletion } from "./utils/memeDeletion";
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
const RemixEditorPage = lazy(() => import("./components/RemixEditorPage"));
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

const RIZZ_STORAGE_KEY = "rizz-generator-saved-v1";

function normalizeRizzText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function dedupeRizzItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeRizzText(item?.text || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readLocalSavedRizz() {
  try {
    const saved = localStorage.getItem(RIZZ_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return dedupeRizzItems(
      parsed
        .map((item) => ({
          text: normalizeRizzText(item?.text || ""),
          category: item?.category || "all",
          source: item?.source || "api",
          createdAt: item?.createdAt || new Date().toISOString(),
        }))
        .filter((item) => item.text)
    );
  } catch {
    return [];
  }
}

function toSavedRizzRecord(item) {
  const text = normalizeRizzText(item?.text || "");

  return {
    text,
    textKey: text.toLowerCase(),
    category: item?.category || "all",
    source: item?.source || "api",
    createdAt: item?.createdAt || item?.created_at || new Date().toISOString(),
  };
}

function mergeSavedRizz(items = []) {
  return dedupeRizzItems(items.map(toSavedRizzRecord).filter((item) => item.text));
}

// Helper to ensure data from any source matches the component expectations
const normalizeMeme = (m, currentUserId) => {
  const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  const isAutoMeme =
    m.is_auto === true ||
    m.is_auto === "true" ||
    m.original_source === "meme-api";
  
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
      : (isAutoMeme ? "Auto" : "Owner"),
    image: m.image_url || m.image || "",
    isDatabaseMeme: Boolean(m.image_url || m.created_at || m.user_id),
    isAutoMeme,
  };
};  

const getMemeRouteTarget = (url) => {
  const memeQuery = url.searchParams.get("meme");
  if (memeQuery) return memeQuery;

  const match = url.pathname.match(/^\/meme\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
};

const buildMemeRoute = (meme) => {
  const target = meme?.slug || meme?.id;
  return target ? `/meme/${encodeURIComponent(String(target))}` : "/";
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
const GLOBAL_MEMES_API_URL = "/api/memes";

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function fetchGlobalMemesFromApi() {
  const response = await fetch(GLOBAL_MEMES_API_URL);
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload?.error || `Global meme feed returned ${response.status}.`);
  }

  return Array.isArray(payload?.memes) ? payload.memes : [];
}

async function fetchGlobalMemesFromSupabase() {
  const primary = await supabase
    .from("meme-table")
    .select("*, profiles(username)")
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return Array.isArray(primary.data) ? primary.data : [];
  }

  const fallback = await supabase
    .from("meme-table")
    .select("*")
    .order("created_at", { ascending: false });

  if (fallback.error) {
    throw primary.error;
  }

  return Array.isArray(fallback.data) ? fallback.data : [];
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [favorites, setFavorites] = useState(getInitialFavorites);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savedRizz, setSavedRizz] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isThemeSwitcherOpen, setIsThemeSwitcherOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDraft, setUploadDraft] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRizzOpen, setIsRizzOpen] = useState(false);
  const [isSavedRizzOpen, setIsSavedRizzOpen] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [isBottomEditorVisible, setIsBottomEditorVisible] = useState(false);
  const [dbMemes, setDbMemes] = useState([]);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [pendingMemeDelete, setPendingMemeDelete] = useState(null);
  const [deleteConfirmCountdown, setDeleteConfirmCountdown] = useState(0);
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
  const [isMobileHeaderCompact, setIsMobileHeaderCompact] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isUsernameConfirmOpen, setIsUsernameConfirmOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [memeList, setMemeList] = useState([]);
  const [currentMemeId, setCurrentMemeId] = useState(null);
  const [currentMemeIndex, setCurrentMemeIndex] = useState(-1);
  const allMemesNormalized = useMemo(() => {
    return [...dbMemes, ...memes].map(m => normalizeMeme(m, user?.id));
  }, [dbMemes, user?.id]);
  const autoMemesCount = useMemo(
    () => allMemesNormalized.filter((meme) => meme.isAutoMeme).length,
    [allMemesNormalized]
  );
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const path = currentPath;
  const isMoodSearchPage = path === "/mood-search";
  const isOverlayOpen = Boolean(
    isSidebarOpen ||
      isThemeSwitcherOpen ||
      currentMemeId ||
      isEditorModalOpen ||
      isUploadModalOpen ||
      isLoginModalOpen ||
      isHelpOpen ||
      isLogoutConfirmOpen ||
      isResetConfirmOpen ||
      isAvatarModalOpen ||
      isUsernameModalOpen ||
      isUsernameConfirmOpen ||
      notification ||
      resetStatus ||
      showIosInstallModal ||
      isRizzOpen
  );
  const navigateTo = useCallback((nextPath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setCurrentPath(nextPath);
  }, []);
  const SidebarLink = ({ icon, label, onClick, rightIcon }) => (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-zinc-400 transition-all group hover:bg-white/5 hover:text-white sm:gap-4 sm:rounded-2xl sm:p-4"
    >
      <span className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="scale-90 text-violet-400 transition-transform group-hover:scale-110 sm:scale-100">{icon}</div>
        <span className="truncate font-medium">{label}</span>
      </span>
      {rightIcon ? (
        <span className="flex items-center justify-center text-zinc-500 transition group-hover:text-white">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );

  useEffect(() => {
    try {
      localStorage.setItem("favorite-memes", JSON.stringify(favorites));
    } catch {
      // Keep the app usable if the browser blocks storage writes.
    }
  }, [favorites]);

  useEffect(() => {
    let isCancelled = false;

    const loadSavedRizz = async () => {
      const localSaved = readLocalSavedRizz();

      if (!user?.id) {
        if (!isCancelled) {
          setSavedRizz(localSaved);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("saved_rizz")
          .select("text, category, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const remoteSaved = Array.isArray(data)
          ? data.map((item) =>
              toSavedRizzRecord({
                text: item?.text || "",
                category: item?.category || "all",
                source: item?.source || "api",
                createdAt: item?.created_at || new Date().toISOString(),
              })
            )
          : [];

        const merged = mergeSavedRizz([...remoteSaved, ...localSaved]);

        if (!isCancelled) {
          setSavedRizz(merged);
        }
      } catch {
        if (!isCancelled) {
          setSavedRizz(localSaved);
        }
      }
    };

    void loadSavedRizz();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  useEffect(() => {
    if (!allMemesNormalized.length) return;

    const url = new URL(window.location.href);
    const routeTarget = getMemeRouteTarget(url);
    if (!routeTarget) return;

    const activeList = memeList.length > 0 ? memeList : allMemesNormalized;
    const nextIndex = activeList.findIndex((meme) => {
      const memeId = String(meme.id);
      const memeSlug = meme.slug ? String(meme.slug) : "";
      return memeId === routeTarget || memeSlug === routeTarget;
    });

    if (nextIndex < 0) return;

    const nextMeme = activeList[nextIndex];
    if (!nextMeme) return;

    if (String(currentMemeId) !== String(nextMeme.id) || currentMemeIndex !== nextIndex) {
      setCurrentMemeId(nextMeme.id);
      setCurrentMemeIndex(nextIndex);
    }
  }, [allMemesNormalized, currentMemeId, currentMemeIndex, memeList]);

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
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;

    if (!media) {
      setShowIosInstallHint(false);
      return undefined;
    }

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
    const updateHeaderMode = () => {
      const isMobile = window.innerWidth < 640;
      const shouldCompact = path === "/" && isMobile && window.scrollY > 24;
      setIsMobileHeaderCompact(shouldCompact);
    };

    let frameId = 0;
    const handleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHeaderMode);
    };

    updateHeaderMode();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateHeaderMode);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateHeaderMode);
    };
  }, [path]);

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

  useEffect(() => {
    setMemeList(allMemesNormalized);
  }, [allMemesNormalized]);

  const currentMeme = useMemo(() => {
    if (currentMemeId == null) return null;
    const activeList = memeList.length > 0 ? memeList : allMemesNormalized;
    return activeList.find((meme) => String(meme.id) === String(currentMemeId)) || null;
  }, [allMemesNormalized, currentMemeId, memeList]);

  useEffect(() => {
    if (currentMemeId == null) {
      if (currentMemeIndex !== -1) setCurrentMemeIndex(-1);
      return;
    }

    const nextIndex = memeList.findIndex((meme) => String(meme.id) === String(currentMemeId));
    if (nextIndex === -1) {
      setCurrentMemeId(null);
      setCurrentMemeIndex(-1);
      return;
    }

    if (nextIndex !== currentMemeIndex) {
      setCurrentMemeIndex(nextIndex);
    }
  }, [currentMemeId, currentMemeIndex, memeList]);

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
    } else if (viewMode === "auto") {
      baseList = baseList.filter((m) => m.isAutoMeme);
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
  const displayUsername =
    profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0] || "Meme Creator";
  const isAdminUser = profile?.role === "admin";
  const isBlockedUser = profile?.role === "blocked";
  const normalizedUsernameDraft = usernameDraft.trim();
  const hasPendingAvatarChange = selectedAvatarId !== currentAvatarId;
  const hasPendingUsernameChange =
    Boolean(normalizedUsernameDraft) && normalizedUsernameDraft !== displayUsername;

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

  const openUsernameModal = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    setUsernameDraft(displayUsername);
    setIsUsernameConfirmOpen(false);
    setIsUsernameModalOpen(true);
  };

  const closeUsernameModal = () => {
    if (isSavingUsername) return;
    setUsernameDraft(displayUsername);
    setIsUsernameConfirmOpen(false);
    setIsUsernameModalOpen(false);
  };

  const openUsernameConfirm = () => {
    if (!normalizedUsernameDraft) {
      setNotification({ type: "error", message: "Please enter a username." });
      return;
    }

    if (!hasPendingUsernameChange) {
      setNotification({ type: "error", message: "Please enter a different username." });
      return;
    }

    setIsUsernameModalOpen(false);
    setIsUsernameConfirmOpen(true);
  };

  useEffect(() => {
    if (!user) {
      setUsernameDraft("");
      return;
    }

    setUsernameDraft(displayUsername);
  }, [user, displayUsername]);

  const fetchProfile = async (userId, userData) => {
    // Use maybeSingle to check if profile exists
    let { data, error } = await supabase
      .from("profiles")
      .select("id, username, points, role")
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
        .select("id, username, points, role")
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
          setIsUsernameModalOpen(false);
          setIsUsernameConfirmOpen(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  const openMeme = (meme) => {
    if (!meme) return;
    const activeList = memeList.length > 0 ? memeList : allMemesNormalized;
    const nextIndex = activeList.findIndex((item) => String(item.id) === String(meme.id));
    setCurrentMemeId(meme.id);
    setCurrentMemeIndex(nextIndex);
    window.history.replaceState({}, "", buildMemeRoute(meme));
  };

  const closeModal = () => {
    setCurrentMemeId(null);
    setCurrentMemeIndex(-1);
    window.history.replaceState({}, "", "/");
  };

  const handleRandomMeme = () => {
    const activeList = memeList.length > 0 ? memeList : allMemesNormalized;
    if (activeList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * activeList.length);
    openMeme(activeList[randomIndex]);
  };

  const navigateMeme = useCallback(
    (direction) => {
      const activeList = memeList.length > 0 ? memeList : allMemesNormalized;
      if (!activeList.length || currentMemeIndex < 0) return false;

      const nextIndex = currentMemeIndex + direction;
      if (nextIndex < 0 || nextIndex >= activeList.length) return false;

      const nextMeme = activeList[nextIndex];
      if (!nextMeme) return false;

      setCurrentMemeId(nextMeme.id);
      setCurrentMemeIndex(nextIndex);

      const url = new URL(window.location);
      url.searchParams.set("meme", nextMeme.id);
      window.history.replaceState({}, "", url);
      return true;
    },
    [allMemesNormalized, currentMemeIndex, memeList]
  );

  const handlePreviousMeme = useCallback(() => navigateMeme(-1), [navigateMeme]);
  const handleNextMeme = useCallback(() => navigateMeme(1), [navigateMeme]);

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

  const handleUsernameSave = async () => {
    if (!user) return;

    if (!normalizedUsernameDraft) {
      setNotification({ type: "error", message: "Please enter a username." });
      setIsUsernameConfirmOpen(false);
      setIsUsernameModalOpen(true);
      return;
    }

    if (!hasPendingUsernameChange) {
      setNotification({ type: "error", message: "Please enter a different username." });
      setIsUsernameConfirmOpen(false);
      setIsUsernameModalOpen(true);
      return;
    }

    setIsSavingUsername(true);
    try {
      let nextProfile = null;

      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({ username: normalizedUsernameDraft })
        .eq("id", user.id)
        .select("id, username, points, role")
        .maybeSingle();

      if (profileError) {
        const isTaken = profileError.code === "23505";
        setNotification({
          type: "error",
          message: isTaken
            ? "That username is already taken. Please choose another one."
            : profileError.message,
        });
        setIsUsernameConfirmOpen(false);
        setIsUsernameModalOpen(true);
        return;
      }

      if (updatedProfile) {
        nextProfile = updatedProfile;
      } else {
        const { data: insertedProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ id: user.id, username: normalizedUsernameDraft, points: 0 })
          .select("id, username, points, role")
          .maybeSingle();

        if (insertError) {
          const isTaken = insertError.code === "23505";
          setNotification({
            type: "error",
            message: isTaken
              ? "That username is already taken. Please choose another one."
              : insertError.message || "Could not update username right now.",
          });
          setIsUsernameConfirmOpen(false);
          setIsUsernameModalOpen(true);
          return;
        }

        nextProfile = insertedProfile;
      }

      const nextMetadata = {
        ...user.user_metadata,
        username: normalizedUsernameDraft,
      };

      const { error: authError } = await supabase.auth.updateUser({
        data: nextMetadata,
      });

      if (authError) {
        console.warn("Auth metadata sync warning:", authError.message);
      }

      setProfile(nextProfile || profile);
      setUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              user_metadata: nextMetadata,
            }
          : currentUser
      );
      setNotification({
        type: "success",
        message: authError
          ? "Username updated, but metadata sync needs a refresh. Please re-open your profile."
          : "Username updated successfully.",
      });
      setIsUsernameConfirmOpen(false);
      setIsUsernameModalOpen(false);
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleUploadMeme = (meme) => {
    setDbMemes((prev) => [normalizeMeme(meme, user?.id), ...prev]);
    if (meme?.id !== undefined && meme?.id !== null) {
      setDbLikeCounts((prev) => ({ ...prev, [String(meme.id)]: prev[String(meme.id)] || 0 }));
    }
    if (user) fetchProfile(user.id, user); // Refresh points immediately
    fetchLeaderboard();
  };

  const handleOpenUploadFromSearch = useCallback((meme) => {
    if (!meme?.imageUrl) return;

    const nextDraft = {
      imageUrl: meme.imageUrl,
      title: String(meme.title || "Mood meme").trim() || "Mood meme",
      selectionKey: `${meme.id || meme.imageUrl || "mood-meme"}-${Date.now()}`,
    };

    setUploadDraft(nextDraft);
    setIsUploadModalOpen(true);
  }, []);

  const handleAdminMemePublished = useCallback(
    (memesToAdd = []) => {
      const nextMemes = Array.isArray(memesToAdd) ? memesToAdd : [];
      if (nextMemes.length === 0) return;

      const normalizedNextMemes = nextMemes.map((meme) => normalizeMeme(meme, user?.id));
      const nextIds = new Set(normalizedNextMemes.map((meme) => String(meme.id)));

      setDbMemes((prev) => [
        ...normalizedNextMemes,
        ...prev.filter((meme) => !nextIds.has(String(meme.id))),
      ]);

      if (user) fetchProfile(user.id, user);
      fetchLeaderboard();
    },
    [user?.id]
  );

  const handleMemeDeleted = useCallback((memeId) => {
    const targetId = String(memeId);

    setDbMemes((prev) => prev.filter((meme) => String(meme.id) !== targetId));
    setSemanticMemes((prev) => prev.filter((meme) => String(meme.id) !== targetId));
    setFavorites((prev) => prev.filter((favoriteId) => String(favoriteId) !== targetId));
    setLikedMemeIds((prev) => prev.filter((likedId) => String(likedId) !== targetId));

    setDbLikeCounts((prev) => {
      if (!(targetId in prev)) return prev;
      const next = { ...prev };
      delete next[targetId];
      return next;
    });

    setOwnerLikeCounts((prev) => {
      if (!(targetId in prev)) return prev;
      const next = { ...prev };
      delete next[targetId];
      return next;
    });

      if (currentMemeId && String(currentMemeId) === targetId) {
      window.history.replaceState({}, "", "/");
      setCurrentMemeId(null);
      setCurrentMemeIndex(-1);
    }
  }, [currentMemeId]);

  useEffect(() => {
    if (!pendingMemeDelete) {
      setDeleteConfirmCountdown(0);
      return undefined;
    }

    if (deleteConfirmCountdown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setDeleteConfirmCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [deleteConfirmCountdown, pendingMemeDelete]);

  const executeMemeDelete = useCallback(
    async (meme) => {
      const memeId = typeof meme === "object" ? meme?.id : meme;
      if (!memeId) return false;

      try {
        await prepareMemeDeletion(supabase, memeId);

        handleMemeDeleted(memeId);
        setNotification({
          type: "success",
          message: "Meme deleted successfully.",
        });
        return true;
      } catch (error) {
        console.error("Admin meme delete failed:", error);
        setNotification({
          type: "error",
          message: error.message || "Could not delete that meme right now.",
        });
        return false;
      }
    },
    [handleMemeDeleted]
  );

  const handleDeleteMeme = useCallback(
    async (meme) => {
      const memeId = typeof meme === "object" ? meme?.id : meme;
      if (!memeId) return false;

      if (!isAdminUser) {
        setNotification({
          type: "error",
          message: "Only admins can delete memes from the home page.",
        });
        return false;
      }

      setPendingMemeDelete({
        meme,
        memeId,
        memeTitle: typeof meme === "object" ? meme?.title || "this meme" : "this meme",
      });
      setDeleteConfirmCountdown(3);
      return false;
    },
    [isAdminUser]
  );

  const cancelMemeDelete = useCallback(() => {
    setPendingMemeDelete(null);
    setDeleteConfirmCountdown(0);
  }, []);

  const confirmMemeDelete = useCallback(async () => {
    if (!pendingMemeDelete) return false;
    const target = pendingMemeDelete;
    setPendingMemeDelete(null);
    setDeleteConfirmCountdown(0);
    return executeMemeDelete(target.meme);
  }, [executeMemeDelete, pendingMemeDelete]);

  useEffect(() => {
    const fetchMemes = async () => {
      const startedAt = Date.now();
      setLoading(true);

      try {
        let nextMemes = [];

        try {
          nextMemes = await fetchGlobalMemesFromApi();
        } catch (apiError) {
          console.warn("Global meme API unavailable, falling back to Supabase:", apiError);
        }

        if (nextMemes.length === 0) {
          try {
            nextMemes = await fetchGlobalMemesFromSupabase();
          } catch (dbError) {
            console.error("Error fetching memes:", dbError);
            return;
          }
        }

        const formatted = nextMemes.map((m) => normalizeMeme(m));
        setDbMemes(formatted);
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 1000 - elapsed);
        window.setTimeout(() => {
          setLoading(false);
        }, remaining);
      }
    };

    fetchMemes();
  }, []);
  const showLoader = loading && path !== "/reset-password" && path !== "/admin";

  if (path === "/reset-password") {
    return <ResetPassword user={user} />;
  }

  if (path === "/admin") {
    return (
      <AdminModeration
        user={user}
        onBack={() => navigateTo("/")}
        onMemeDeleted={handleMemeDeleted}
        onMemePublished={handleAdminMemePublished}
      />
    );
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
        <SidebarLink 
          icon={<Home size={20}/>} 
          label="Home" 
          onClick={() => { 
            navigateTo("/");
            setViewMode("all"); 
            setIsSidebarOpen(false); 
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            window.scrollTo({top: 0, behavior: 'smooth'}); 
          }} 
        />
        <SidebarLink 
          icon={<Trophy size={20}/>} 
          label="Leaderboard" 
          onClick={() => { 
            setViewMode("leaderboard"); 
            fetchLeaderboard(); 
            setIsSidebarOpen(false); 
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            window.scrollTo({top: 0, behavior: 'smooth'}); 
          }} 
        />
        <SidebarLink icon={<Search size={20}/>} label="Search" onClick={() => { setIsSidebarOpen(false); setIsEditorModalOpen(false); setIsUploadModalOpen(false); closeModal(); document.querySelector('input[type="text"]')?.focus(); }} />
        <SidebarLink
          icon={<Sparkles size={20} />}
          label="Rizz 😏"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            setIsRizzOpen(true);
          }}
        />
        <SidebarLink
          icon={<Search size={20} />}
          label="Global Meme"
          rightIcon={<Globe size={18} className="text-cyan-400" />}
          onClick={() => {
            setIsSidebarOpen(false);
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            navigateTo("/mood-search");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
        {user && (
          <>
            <SidebarLink 
              icon={<Image size={20}/>} 
              label="My Uploads" 
              onClick={() => { 
                setViewMode("uploads");
                setIsSidebarOpen(false);
                setIsEditorModalOpen(false);
                setIsUploadModalOpen(false);
                closeModal();
                window.scrollTo({top: 0, behavior: 'smooth'});
              }} 
            />
            <SidebarLink 
              icon={<Bookmark size={20}/>} 
              label="Bookmarks" 
              onClick={() => { 
                setViewMode("favorites");
                setIsSidebarOpen(false);
                setIsEditorModalOpen(false);
                setIsUploadModalOpen(false);
                closeModal();
                window.scrollTo({top: 0, behavior: 'smooth'});
              }} 
            />
          </>
        )}
        <SidebarLink
          icon={<Pencil size={20}/>}
          label="Edit Meme"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            if (isBlockedUser) {
              setNotification({
                type: "error",
                message: "Your account is blocked from editing memes.",
              });
              return;
            }
            setIsEditorModalOpen(true);
          }}
        />
        <SidebarLink 
          icon={<Upload size={20}/>} 
          label="Upload Meme" 
          onClick={() => { 
            if (isBlockedUser) {
              setIsSidebarOpen(false);
              setNotification({
                type: "error",
                message: "Your account is blocked from uploading memes.",
              });
              return;
            }
            setIsSidebarOpen(false); 
            setIsEditorModalOpen(false);
            closeModal();
            setUploadDraft(null);
            user ? setIsUploadModalOpen(true) : setIsLoginModalOpen(true); 
          }} 
        />
        <div className="my-2 border-t border-white/10" />
        <SidebarLink 
          icon={<HelpCircle size={20}/>} 
          label="How to Use" 
          onClick={() => { 
            setIsSidebarOpen(false); 
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            setIsHelpOpen(true); 
          }} 
        />
        {isAdminUser ? (
          <SidebarLink
            icon={<ShieldCheck size={20} />}
            label="Admin Panel"
            onClick={() => {
              setIsSidebarOpen(false);
              setIsEditorModalOpen(false);
              setIsUploadModalOpen(false);
              closeModal();
              navigateTo("/admin");
            }}
          />
        ) : null}
      </nav>

      <div className="pt-3 sm:pt-6 border-t border-white/10 mt-2 sm:mt-6 flex-shrink-0">
        {user ? (
          <div className="space-y-2 sm:space-y-4">
            <button 
              onClick={() => { 
                setViewMode("profile");
                setIsSidebarOpen(false);
                setIsEditorModalOpen(false);
                setIsUploadModalOpen(false);
                closeModal();
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
                  {displayUsername}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </button>
            <SidebarLink icon={<LogOut size={20}/>} label="Log Out" onClick={() => { 
              setIsSidebarOpen(false); 
              setIsEditorModalOpen(false);
              setIsUploadModalOpen(false);
              closeModal();
              setIsLogoutConfirmOpen(true); 
            }} />
          </div>
        ) : (
          <SidebarLink icon={<LogIn size={20}/>} label="Sign In" onClick={() => { 
            setIsSidebarOpen(false); 
            setIsEditorModalOpen(false);
            setIsUploadModalOpen(false);
            closeModal();
            setIsLoginModalOpen(true); 
          }} />
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>{showLoader ? <Loader /> : null}</AnimatePresence>
      <RizzGeneratorSidebar isOpen={isRizzOpen} onOpenChange={setIsRizzOpen} user={user} />
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex">
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block fixed top-0 left-0 z-[110] h-screen w-72 bg-[var(--app-surface)] border-r border-[color:var(--app-border)] p-6 shadow-2xl overflow-y-auto">
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
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 z-[121] h-[100dvh] w-[80%] bg-[var(--app-surface)] border-r border-[color:var(--app-border)] p-4 sm:p-6 shadow-2xl sm:w-64 lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:pl-72 min-w-0">
        <div className="relative isolate overflow-x-clip">
          <header className="sticky top-0 z-[105] border-b border-[color:var(--app-border)] bg-[color:var(--app-bg)]/92 backdrop-blur-xl transition-all">
            <div className="mx-auto max-w-6xl px-3 py-2 sm:px-6 sm:py-3">
              <AnimatePresence mode="wait" initial={false}>
                {isMobileHeaderCompact ? (
                  <motion.div
                    key="compact-header"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex items-center justify-between gap-2 rounded-[1.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 shadow-[0_18px_60px_rgba(2,6,23,0.12)] sm:rounded-[2rem] sm:px-4 sm:py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-2 transition hover:scale-[1.03] hover:bg-[color:var(--app-surface)]"
                      >
                        <Menu size={20} />
                      </button>
                      <img
                        src={logo}
                        alt="RoastRiot Logo"
                        className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
                      />
                    </div>

                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <ThemeSwitcher
                          isOpen={isThemeSwitcherOpen}
                          onOpenChange={setIsThemeSwitcherOpen}
                        />
                      {profile ? (
                        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-2 py-1">
                          <Award size={13} className="text-[color:var(--app-accent)]" />
                            <span className="text-[10px] font-bold">
                              {profile.points}
                            </span>
                          </div>
                        ) : null}
                        <button
                          onClick={() => {
                            setViewMode(viewMode === "favorites" ? "all" : "favorites");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-2 py-1 text-[10px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                          aria-label="Saved memes"
                        >
                          <Bookmark size={13} className={viewMode === "favorites" ? "fill-violet-400" : ""} />
                          <span>{favorites.length}</span>
                        </button>
                        <NotificationBell user={user} />
                        {!user ? (
                          <button
                            onClick={() => setIsLoginModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-2 text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                            aria-label="Login"
                        >
                          <LogIn size={16} />
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="expanded-header"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex flex-col gap-2.5 rounded-[1.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2.5 shadow-[0_18px_60px_rgba(2,6,23,0.12)] sm:gap-3 sm:rounded-[2rem] sm:px-5 sm:py-3 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 md:gap-3 lg:gap-4">
                      <div className="flex min-w-0 items-center gap-2 md:gap-3 lg:gap-4">
                        <button
                          onClick={() => setIsSidebarOpen(true)}
                          className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-2 transition hover:scale-[1.03] hover:bg-[color:var(--app-surface)] lg:hidden"
                        >
                          <Menu size={20} />
                        </button>
                        <img
                          src={logo}
                          alt="RoastRiot Logo"
                          className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
                        />
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 md:gap-2">
                        <ThemeSwitcher
                          isOpen={isThemeSwitcherOpen}
                          onOpenChange={setIsThemeSwitcherOpen}
                        />
                        {profile ? (
                          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-2 py-1 sm:gap-1.5 sm:px-4 sm:py-2 md:px-2.5 md:py-1.5">
                            <Award size={13} className="text-[color:var(--app-accent)] sm:w-4 sm:h-4" />
                            <span className="text-[9px] font-bold sm:text-sm md:text-[11px]">
                              {profile.points} pts
                            </span>
                        </div>
                      ) : null}
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      <motion.div
                        key="expanded-actions"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex w-full flex-wrap items-center justify-end gap-1.5 border-t border-[color:var(--app-border)]/60 pt-2.5 sm:gap-2 sm:pt-3 md:w-auto md:flex-nowrap md:border-t-0 md:pt-0 md:gap-2 lg:gap-2.5"
                      >
                        {!user ? (
                          <button
                            onClick={() => setIsLoginModalOpen(true)}
                            className="shrink-0 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)] sm:px-4 sm:py-2 sm:text-sm md:px-2.5 md:py-1.5 md:text-[11px]"
                          >
                            Login
                          </button>
                        ) : null}
                        <button
                          onClick={handleRandomMeme}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:scale-105 active:scale-95 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm md:gap-1 md:px-2.5 md:py-1.5 md:text-[11px]"
                        >
                          <Sparkles size={14} />
                          <span className="hidden sm:inline">Get Random Meme</span>
                          <span className="sm:hidden">Random</span>
                        </button>
                        {!isStandaloneMode && (isInstallable || showIosInstallHint) ? (
                          <button
                            onClick={handleInstallApp}
                            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)] sm:gap-2 sm:px-4 sm:py-2 sm:text-sm md:gap-1 md:px-2.5 md:py-1.5 md:text-[11px]"
                          >
                            <Download size={14} />
                            <span className="hidden sm:inline">Install App</span>
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            setViewMode(viewMode === "favorites" ? "all" : "favorites");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:gap-2 sm:px-4 sm:py-2 sm:text-sm md:gap-1 md:px-2.5 md:py-1.5 md:text-[11px] ${
                            viewMode === "favorites"
                              ? "border-[color:var(--app-accent)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]"
                              : "border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)]"
                          }`}
                        >
                          <Bookmark size={14} className={viewMode === "favorites" ? "fill-violet-400" : ""} />
                          <span className="hidden xs:inline">Bookmarks:</span>
                          <span>{favorites.length}</span>
                        </button>
                        <button
                          onClick={() => {
                            setViewMode(viewMode === "auto" ? "all" : "auto");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:gap-2 sm:px-4 sm:py-2 sm:text-sm md:gap-1 md:px-2.5 md:py-1.5 md:text-[11px] ${
                            viewMode === "auto"
                              ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                              : "border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)]"
                          }`}
                        >
                          <Sparkles size={14} className={viewMode === "auto" ? "text-cyan-300" : ""} />
                          <span className="hidden xs:inline">Auto:</span>
                          <span>{autoMemesCount}</span>
                        </button>
                        <NotificationBell user={user} />
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          {viewMode === "leaderboard" ? (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 max-w-2xl mx-auto p-6 sm:p-10 bg-[color:var(--app-surface)] border border-[color:var(--app-border)] rounded-[2.5rem] shadow-2xl text-center"
            >
              <div className="mb-6 text-left">
                <button
                  onClick={() => setViewMode("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </div>
              <Trophy size={48} className="mx-auto mb-4 text-amber-500" />
              <h2 className="mb-2 text-3xl font-black text-[color:var(--app-text)]">Meme Hall of Fame</h2>
              <p className="mb-8 text-[color:var(--app-muted)]">Top contributors in the RoastRiot community</p>
              
              <div className="space-y-3">
                {leaderboard.map((player, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 transition hover:bg-[color:var(--app-surface)]"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-amber-400 text-black' : 
                        idx === 1 ? 'bg-zinc-300 text-black' : 
                        idx === 2 ? 'bg-amber-700 text-white' : 'bg-[color:var(--app-bg)] text-[color:var(--app-muted)]'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold text-[color:var(--app-text)]">{player.username}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getBadge(player.points).bg} ${getBadge(player.points).color}`}>
                        {getBadge(player.points).name}
                      </span>
                    </div>
                    <span className="font-black text-[color:var(--app-accent)]">{player.points} pts</span>
                  </div>
                ))}
              </div>
            </motion.section>
          ) : viewMode === "profile" && user ? (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 max-w-2xl mx-auto p-6 sm:p-10 bg-[color:var(--app-surface)] border border-[color:var(--app-border)] rounded-[2.5rem] shadow-2xl"
            >
              <div className="mb-6">
                <button
                  onClick={() => setViewMode("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
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
                    className="w-full h-full rounded-full bg-[color:var(--app-surface)] object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold">{displayUsername}</h2>
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

                <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <UserIcon size={18} className="text-violet-400" />
                    <h3 className="font-semibold">Profile Username</h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Update the name shown on your profile, uploads, and leaderboard.
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-3">
                    <div>
                      <p className="text-xs text-zinc-500">Current username</p>
                      <p className="font-semibold text-white">{displayUsername}</p>
                    </div>
                    <button
                      onClick={openUsernameModal}
                      className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02]"
                    >
                      Change Username
                    </button>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 sm:p-5">
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

                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-3">
                    <img
                      src={currentAvatarUrl}
                      alt="Current avatar preview"
                      className="h-14 w-14 rounded-full border border-violet-400/30 bg-[color:var(--app-surface)] object-cover"
                    />
                    <div>
                      <p className="font-semibold text-white">Current avatar</p>
                      <p className="text-xs text-zinc-500">Click Change Avatar to view all avatar styles.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => setIsSavedRizzOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                    aria-expanded={isSavedRizzOpen}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-fuchsia-400" />
                        <h3 className="font-semibold">Saved Rizz</h3>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Your saved pickup lines from the rizz drawer.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--app-text)]">
                        {savedRizz.length}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-zinc-500 transition-transform duration-200 ${isSavedRizzOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isSavedRizzOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0, y: -6 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3">
                          {savedRizz.length > 0 ? (
                            savedRizz.slice(0, 3).map((item, index) => (
                              <button
                                key={`${item.createdAt}-${index}`}
                                type="button"
                                onClick={() => setIsRizzOpen(true)}
                                className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-4 text-left transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)]"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                                    {item.category || "all"} / {item.source === "api" ? "api" : "fallback"}
                                  </span>
                                  <Heart size={14} className="fill-[color:var(--app-accent)] text-[color:var(--app-accent)]" />
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--app-text)]">
                                  {item.text}
                                </p>
                              </button>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-4 text-sm text-zinc-500">
                              Save a line in the rizz drawer and it will show up here.
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setIsRizzOpen(true)}
                            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition hover:scale-[1.01]"
                          >
                            Open Rizz Generator
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full p-4 rounded-2xl bg-[color:var(--app-surface-2)] border border-[color:var(--app-border)] hover:bg-[color:var(--app-surface)] transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                      <LogIn size={18} />
                    </div>
                    <span className="font-semibold">Request Password Reset Email</span>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600 group-hover:text-[color:var(--app-text)] group-hover:translate-x-1 transition-all" />
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
              {isMoodSearchPage ? (
                <MoodMemeSearchPage
                  onBackHome={() => navigateTo("/")}
                  onUploadToRoastRiot={handleOpenUploadFromSearch}
                />
              ) : (
                <>
                  <Hero />
                  <section className="-mt-16 relative z-20 rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
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
                            : viewMode === "auto"
                            ? "Auto-Ingested Memes"
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
                      isAdminUser={isAdminUser}
                      isBlockedUser={isBlockedUser}
                      onDeleteMeme={handleDeleteMeme}
                      likeCounts={allLikeCounts}
                      onLikeCountChange={handleLikeCountChange}
                      onLikeStateChange={handleLikeStateChange}
                    />
                  </section>
                </>
              )}
            </>
          )}

          {/* Default Bottom Editor */}
          <section className="mt-20 mb-10">
            {!isBottomEditorVisible ? (
              <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-8 text-center backdrop-blur-xl sm:p-12">
                <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Pencil className="text-violet-400" size={32} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready to Create?</h2>
                <p className="text-zinc-400 max-w-md mb-8 text-sm sm:text-base">
                  Launch the meme studio to build your own situational roasts using our built-in canvas tool.
                </p>
                <button
                  onClick={() => {
                    if (isBlockedUser) {
                      setNotification({
                        type: "error",
                        message: "Your account is blocked from editing memes.",
                      });
                      return;
                    }

                    setIsEditorModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-lg shadow-xl shadow-violet-500/20 hover:opacity-90 active:scale-95 transition-all"
                >
                  <Pencil size={20} /> Open Meme Studio
                </button>
              </div>
            ) : (
              <div className="relative rounded-[2.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8 lg:p-10">
                <button 
                  onClick={() => setIsBottomEditorVisible(false)}
                  className="absolute top-6 right-6 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5"
                  aria-label="Close studio"
                >
                  <X size={20} />
                </button>
                <h2 className="mb-8 text-2xl sm:text-3xl font-black flex items-center gap-3">
                  <Pencil className="text-violet-400" /> Meme Studio
                </h2>
                <MemeEditor user={user} onUpload={handleUploadMeme} isBlockedUser={isBlockedUser} />
              </div>
            )}
          </section>
        </main>

        <Footer />

        {/* Editor Popup Modal */}
        <AnimatePresence>
          {isEditorModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto p-1.5 sm:p-5 lg:pl-72 lg:pr-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditorModalOpen(false)}
                className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_24%),rgba(2,6,23,0.82)] backdrop-blur-2xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 24 }}
            className="relative flex h-[calc(100dvh-0.75rem)] w-full max-w-[1560px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,11,20,0.98),rgba(5,8,16,0.95))] shadow-2xl shadow-black/50 sm:mt-4 sm:h-[calc(100dvh-2.5rem)] sm:rounded-[2.25rem]"
              >
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-white">
                      <Loader2 className="animate-spin text-violet-500" />
                    </div>
                  }
                >
                  <RemixEditorPage
                    user={user}
                    isBlockedUser={isBlockedUser}
                    isModal
                    onBack={() => setIsEditorModalOpen(false)}
                    onUpload={handleUploadMeme}
                    onSuccess={(msg) => {
                      setIsEditorModalOpen(false);
                      setNotification({ type: "success", message: msg });
                    }}
                  />
                </Suspense>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Upload Popup Modal */}
        <AnimatePresence>
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:pl-72">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadDraft(null);
                }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-[2.5rem] border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl"
              >
                <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent px-6 py-5 sm:px-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-violet-300/80">
                        Upload Studio
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">Upload Meme</h2>
                    </div>
                    <button
                      onClick={() => {
                        setIsUploadModalOpen(false);
                        setUploadDraft(null);
                      }}
                      className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 custom-scrollbar">
                  <Suspense
                    fallback={
                      <div className="flex justify-center p-10">
                        <Loader2 className="animate-spin text-violet-500" />
                      </div>
                    }
                  >
                    <UploadMeme
                      user={user}
                      onUpload={handleUploadMeme}
                      onSuccess={(msg) => {
                        setIsUploadModalOpen(false);
                        setUploadDraft(null);
                        setNotification({ type: 'success', message: msg });
                      }}
                      isBlockedUser={isBlockedUser}
                      initialImageUrl={uploadDraft?.imageUrl || ""}
                      initialTitle={uploadDraft?.title || ""}
                      initialSelectionKey={uploadDraft?.selectionKey || ""}
                    />
                  </Suspense>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Avatar Picker Modal */}
        <AnimatePresence>
          {isAvatarModalOpen && user && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 lg:pl-72">
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
          {isUsernameModalOpen && user && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 lg:pl-72">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeUsernameModal}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#0d1220] p-6 shadow-2xl sm:p-8"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Change Username</h2>
                    <p className="mt-1 text-xs text-zinc-500">Choose a new public username.</p>
                  </div>
                  <button onClick={closeUsernameModal} className="rounded-full bg-white/5 p-2 hover:bg-white/10">
                    <X size={20} />
                  </button>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    openUsernameConfirm();
                  }}
                  className="space-y-4"
                >
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(event) => setUsernameDraft(event.target.value)}
                    maxLength={40}
                    autoFocus
                    placeholder="Enter new username"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#111827]/60 px-4 text-white outline-none transition focus:border-violet-500/50"
                  />
                  <p className="text-xs text-zinc-500">Current: {displayUsername}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeUsernameModal}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-semibold text-zinc-300 transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 font-bold text-white transition hover:opacity-90"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isUsernameConfirmOpen && user && (
            <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 lg:pl-72">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (isSavingUsername) return;
                  setIsUsernameConfirmOpen(false);
                  setIsUsernameModalOpen(true);
                }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm rounded-[2.5rem] border border-white/10 bg-[#0d1220] p-8 text-center shadow-2xl"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
                  <UserIcon size={30} />
                </div>
                <h3 className="text-xl font-bold">Confirm Username Change</h3>
                <p className="mt-2 text-zinc-400">
                  Change your username to <span className="font-semibold text-white">{normalizedUsernameDraft}</span>?
                </p>
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    disabled={isSavingUsername}
                    onClick={() => {
                      setIsUsernameConfirmOpen(false);
                      setIsUsernameModalOpen(true);
                    }}
                    className="flex-1 rounded-2xl bg-white/5 py-3 font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSavingUsername}
                    onClick={handleUsernameSave}
                    className="flex-1 rounded-2xl bg-violet-500 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-600 disabled:opacity-60"
                  >
                    {isSavingUsername ? "Saving..." : "Confirm"}
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-72">
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-72">
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 lg:pl-72">
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
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:pl-72">
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 lg:pl-72">
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

      <AnimatePresence>
        {pendingMemeDelete ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 lg:pl-72">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelMemeDelete}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative z-10 w-full max-w-xl rounded-[2rem] border border-red-500/20 bg-[#0d1220] p-6 shadow-2xl shadow-black/50"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
                  <Trash2 size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">
                    Confirm delete
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">
                    Delete this meme?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    This will permanently remove <span className="font-semibold text-zinc-200">{pendingMemeDelete.memeTitle}</span> from the site.
                    Any related reports will be marked as removed.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Meme ID</p>
                <p className="mt-1 break-all text-sm font-semibold text-zinc-100">{pendingMemeDelete.memeId}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 text-sm text-zinc-300">
                    <motion.div
                      animate={
                        deleteConfirmCountdown > 0
                          ? { rotate: [0, -10, 10, 0], scale: [1, 1.08, 1] }
                          : { rotate: 0, scale: 1 }
                      }
                      transition={
                        deleteConfirmCountdown > 0
                          ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 0.2 }
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                        deleteConfirmCountdown > 0
                          ? "border-red-400/30 bg-red-500/10 text-red-300"
                          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      <Clock3 size={16} />
                    </motion.div>

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Delete timer
                      </p>
                      <AnimatePresence mode="wait" initial={false}>
                        {deleteConfirmCountdown > 0 ? (
                          <motion.p
                            key={`countdown-${deleteConfirmCountdown}`}
                            initial={{ y: 8, opacity: 0, filter: "blur(4px)" }}
                            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                            exit={{ y: -8, opacity: 0, filter: "blur(4px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-sm font-semibold text-white"
                          >
                            Confirming in {deleteConfirmCountdown}s
                          </motion.p>
                        ) : (
                          <motion.p
                            key="countdown-ready"
                            initial={{ y: 8, opacity: 0, filter: "blur(4px)" }}
                            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-sm font-semibold text-emerald-300"
                          >
                            You can confirm now
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-zinc-400">
                      {deleteConfirmCountdown > 0 ? "Locked" : "Ready"}
                    </span>
                    <span className={deleteConfirmCountdown > 0 ? "text-red-300" : "text-emerald-300"}>
                      {deleteConfirmCountdown > 0 ? `${deleteConfirmCountdown}s` : "0s"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex justify-center">
                  <motion.div
                    className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
                    animate={
                      deleteConfirmCountdown > 0
                        ? { scale: [1, 1.03, 1], rotate: [0, 1.5, -1.5, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={
                      deleteConfirmCountdown > 0
                        ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2 }
                    }
                  >
                    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                      <defs>
                        <linearGradient id="deleteTimerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="55%" stopColor="#fb923c" />
                          <stop offset="100%" stopColor="#fbbf24" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="10"
                      />
                      <motion.circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="url(#deleteTimerGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={289}
                        animate={{
                          strokeDashoffset: 289 - 289 * Math.max(0, Math.min(1, (3 - deleteConfirmCountdown) / 3)),
                        }}
                        transition={{ type: "spring", stiffness: 90, damping: 18 }}
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <AnimatePresence mode="wait" initial={false}>
                        {deleteConfirmCountdown > 0 ? (
                          <motion.span
                            key={`ring-count-${deleteConfirmCountdown}`}
                            initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                            exit={{ scale: 1.15, opacity: 0, filter: "blur(4px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          >
                            {deleteConfirmCountdown}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="ring-ready"
                            initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-sm font-black uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          >
                            Ready
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                        Confirm delete
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelMemeDelete}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMemeDelete}
                  disabled={deleteConfirmCountdown > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={16} />
                  <AnimatePresence mode="wait" initial={false}>
                    {deleteConfirmCountdown > 0 ? (
                      <motion.span
                        key={`wait-${deleteConfirmCountdown}`}
                        initial={{ y: 6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -6, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        Wait {deleteConfirmCountdown}s
                      </motion.span>
                    ) : (
                      <motion.span
                        key="delete-ready"
                        initial={{ y: 6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        Yes, delete it
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <Suspense fallback={null}>
        <MemeModal
          meme={currentMeme}
          memeList={memeList}
          currentIndex={currentMemeIndex}
          user={user}
          isAdminUser={isAdminUser}
          isBlockedUser={isBlockedUser}
          onDeleteMeme={handleDeleteMeme}
          onClose={closeModal}
          onNext={handleNextMeme}
          onPrevious={handlePreviousMeme}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
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
    </>
  );
}

