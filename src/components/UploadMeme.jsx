import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Upload, Tag, Smile, Search, Type, Link2 } from "lucide-react";

export default function UploadMeme({ user, onUpload, onSuccess }) {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);

  const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with -
      .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
  };

  const isValidHttpUrl = (value) => {
    try {
      const parsedUrl = new URL(value);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) return alert("Please add a meme title first.");

    const hasImageUrl = Boolean(imageUrl.trim());
    const hasFile = Boolean(file);

    if (!hasImageUrl && !hasFile) {
      return alert("Select an image file or paste a direct image URL.");
    }

    if (hasImageUrl && !isValidHttpUrl(imageUrl.trim())) {
      return alert("Please paste a valid http:// or https:// image URL.");
    }

    if (hasFile && !file.type?.startsWith("image/")) {
      return alert("Please choose a valid image file.");
    }

    setLoading(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        alert("Please login first");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", hasImageUrl ? imageUrl.trim() : file);
      formData.append("upload_preset", "meme_upload");

      const res = await fetch("https://api.cloudinary.com/v1_1/dntclntau/image/upload", {
        method: "POST",
        body: formData,
      });
      const cloudData = await res.json();

      if (!res.ok || !cloudData.secure_url) {
        throw new Error(cloudData?.error?.message || "Image upload failed");
      }

      // 🛡️ Profile Guard: Ensure the profile exists before linking a meme to it
      const { error: profileGuardError } = await supabase
        .from("profiles")
        .upsert(
          { 
            id: currentUser.id, // ✅ Matches auth.uid()
            username: currentUser.user_metadata?.username || title.split(' ')[0] || "User",
            points: 0 // Initialize if missing
          },
          { onConflict: 'id' }
        );
      if (profileGuardError) console.warn("Profile sync warning:", profileGuardError.message);

      const slug = `${generateSlug(title)}-${Math.random().toString(36).substring(2, 7)}`;

      const payload = {
        title: title.trim(),
        
        image_url: cloudData.secure_url,
        category: category.trim(),
        mood: mood.trim(),
        keywords: keywords.split(/[\s,]+/).filter(Boolean),
        user_id: currentUser.id, // ✅ Foreign key match
      };

      const { data: savedMeme, error } = await supabase
        .from("meme-table")
        .insert([payload])
        .select("*")
        .single();

      if (error) throw error;

      // 🏆 Atomic point increment via RPC
      const { error: pointError } = await supabase.rpc('increment_points', { amount: 10 });
      if (pointError) console.error("Error earning points:", pointError.message);

      setFile(null);
      setImageUrl("");
      setTitle("");
      setCategory("");
      setMood("");
      setKeywords("");

      if (onUpload && savedMeme) {
        onUpload({
          ...savedMeme,
          username:
            currentUser.user_metadata?.username ||
            currentUser.email?.split("@")[0] ||
            "User",
          image: savedMeme.image_url,
        });
      }

      if (onSuccess) onSuccess("Meme uploaded successfully! 🎉 +10 points earned!");
    } catch (err) {
      console.error("Upload process error:", err);
      alert(`Upload failed: ${err.message || "Something went wrong"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="file-upload" className="block text-sm font-medium text-zinc-300 mb-2">
          Image File
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-zinc-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-violet-500 file:text-white
            hover:file:bg-violet-600 transition-colors
            cursor-pointer"
        />
        {file && <p className="text-xs text-zinc-500 mt-1">Selected: {file.name}</p>}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center justify-center text-zinc-500">
          <Link2 size={18} className="block shrink-0 leading-none" />
        </div>
        <input
          type="url"
          placeholder="Paste direct image URL here"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white placeholder-zinc-500"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Use a direct image link, not the Google Images results page.
        </p>
      </div>

      <div className="relative">
        <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Meme Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white placeholder-zinc-500"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Category (e.g. Reply, Funny)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white placeholder-zinc-500"
        />
      </div>

      <div className="relative">
        <Smile className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Mood (e.g., Happy, Sad, Awkward)"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white placeholder-zinc-500"
        />
      </div>

      <div className="relative">
        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Keywords (comma separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white placeholder-zinc-500"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading}
        className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} /> Uploading...
          </>
        ) : (
          <>
            <Upload size={20} /> Upload Meme
          </>
        )}
      </button>
    </div>
  );
}
