import { useState, useEffect } from "react";
import { Download, Heart, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

export default function MemeCard({ meme, onOpen, toggleFavorite, favorites, user }) {
  const isFavorite = favorites.includes(meme.id);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    const fetchLikes = async () => {
      // Get global like count
      const { count, error: countError } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("meme_id", meme.id);
      
      if (!countError) setLikeCount(count || 0);

      // Check if current user has liked it
      if (user) {
        const { data, error: likedError } = await supabase
          .from("likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("meme_id", meme.id)
          .maybeSingle();
        
        if (!likedError) setLiked(!!data);
      } else {
        setLiked(false);
      }
    };

    fetchLikes();

    // Real-time updates for like count
    const channel = supabase
      .channel(`meme-likes-${meme.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
          filter: `meme_id=eq.${meme.id}`,
        },
        () => fetchLikes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meme.id, user]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) return alert("Please sign in to like memes!");
    if (isLiking) return;

    const previousLiked = liked;
    const previousCount = likeCount;

    // Optimistic UI Update
    setLiked(!previousLiked);
    setLikeCount(prev => (previousLiked ? Math.max(0, prev - 1) : prev + 1));
    setIsLiking(true);

    try {
      if (previousLiked) {
        await supabase.from("likes").delete().eq("user_id", user.id).eq("meme_id", meme.id);
      } else {
        await supabase.from("likes").insert({ user_id: user.id, meme_id: meme.id });
      }
    } catch (error) {
      console.error("Like error:", error);
      setLiked(previousLiked); // Rollback on error
      setLikeCount(previousCount);
    } finally {
      setIsLiking(false);
    }
  };

  // Transform Cloudinary URL for performance
  const getOptimizedUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return url;
    // Inject f_auto (auto format), q_auto (auto quality), w_500 (resize)
    return url.replace("/upload/", "/upload/f_auto,q_auto,w_500,c_scale/");
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(meme.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${meme.title}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div className="group bg-[#101624] border border-white/10 rounded-3xl overflow-hidden hover:border-violet-400/30 transition shadow-lg">
      <div className="relative cursor-pointer" onClick={() => onOpen(meme)}>
        <img
          src={getOptimizedUrl(meme.image)}
          alt={meme.title}
          className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition duration-500 bg-zinc-900"
          loading="lazy"
          decoding="async"
          width="500"
          height="625"
        />

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLike(e);
          }}
          className={`absolute top-2 right-2 sm:top-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition active:scale-90 ${liked ? 'border-pink-500/50' : ''}`}
        >
          <div className="flex flex-col items-center justify-center">
            <motion.div
              animate={{ scale: liked ? [1, 1.4, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                  liked ? "fill-pink-500 text-pink-500" : "text-white"
                }`}
              />
            </motion.div>
            <span className="text-[8px] sm:text-[10px] font-bold text-white mt-0.5">{likeCount}</span>
          </div>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(meme.id);
          }}
          className="absolute top-2 left-2 sm:top-4 sm:left-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition"
        >
          <Bookmark
            className={`w-4 h-4 sm:w-5 sm:h-5 ${
              isFavorite ? "fill-violet-500 text-violet-500" : "text-white"
            }`}
          />
        </button>
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-2xl font-bold line-clamp-1 sm:line-clamp-none">{meme.title}</h3>
        <p className="text-[10px] sm:text-sm text-zinc-400">
          {meme.category} • {meme.mood}
        </p>

        <div className="hidden sm:flex flex-wrap gap-2 mt-4">
          {(Array.isArray(meme.keywords) ? meme.keywords : []).slice(0, 4).map((tag, index) => (
            <span
              key={index}
              className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={handleDownload}
          className="mt-3 sm:mt-5 w-full h-9 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] sm:text-base font-semibold flex items-center justify-center gap-1.5 sm:gap-2 hover:scale-[1.02] transition"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden xs:inline">Download</span>
        </button>
      </div>
    </div>
  );
}