import { useState, useRef } from "react";
import { Download, Upload, Image as ImageIcon, Type, CloudUpload, Loader2, Palette, Tag, Smile, Search } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function MemeEditor({ user, onUpload, onSuccess, isBlockedUser = false }) {
  const [image, setImage] = useState(null);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [keywords, setKeywords] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const canvasRef = useRef(null);

  const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadToHub = async () => {
    if (!user) return alert("Please sign in to upload memes!");
    if (isBlockedUser) return alert("Your account is blocked from uploading memes.");
    if (!uploadTitle.trim()) return alert("Please give your meme a title first.");
    if (!image) return alert("Please choose an image first.");

    setIsUploading(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        alert("Please login first");
        setIsUploading(false);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const blob = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const fontSize = canvas.width / 10;
          ctx.font = `bold ${fontSize}px Impact, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.strokeStyle = "black";
          ctx.lineWidth = fontSize / 15;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          if (topText) {
            ctx.strokeText(topText.toUpperCase(), canvas.width / 2, fontSize);
            ctx.fillText(topText.toUpperCase(), canvas.width / 2, fontSize);
          }

          if (bottomText) {
            ctx.strokeText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
            ctx.fillText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
          }

          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("Canvas to Blob conversion failed"));
          }, "image/jpeg", 0.9);
        };
        img.onerror = () => reject(new Error("Failed to load image for processing"));
        img.src = image;
      });

      const formData = new FormData();
      formData.append("file", blob, "meme.jpg");
      formData.append("upload_preset", "meme_upload");

      const cloudRes = await fetch("https://api.cloudinary.com/v1_1/dntclntau/image/upload", {
        method: "POST",
        body: formData,
      });
      const cloudData = await cloudRes.json();

      if (!cloudRes.ok || !cloudData.secure_url) {
        throw new Error(cloudData?.error?.message || "Cloudinary upload failed");
      }

      // 🛡️ Profile Guard: Ensure the profile exists before linking a meme to it
      const { error: profileGuardError } = await supabase
        .from("profiles")
        .upsert(
          { 
            id: currentUser.id, // ✅ Matches auth.uid()
            username: currentUser.user_metadata?.username || uploadTitle.split(' ')[0] || "User" 
          },
          { onConflict: 'id' }
        );
      if (profileGuardError) console.warn("Profile sync warning:", profileGuardError.message);

      const slug = `${generateSlug(uploadTitle)}-${Math.random().toString(36).substring(2, 7)}`;

      const { data: savedMeme, error } = await supabase
        .from("meme-table")
        .insert([
          {
            title: uploadTitle.trim(),
            slug,
            image_url: cloudData.secure_url,
            user_id: currentUser.id, // ✅ Foreign key match
            category: category.trim(),
            mood: mood.trim(),
            keywords: keywords.split(/[\s,]+/).filter(Boolean),
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      // 🏆 Atomic point increment via RPC
      const { error: pointError } = await supabase.rpc('increment_points', { amount: 10 });
      if (pointError) console.error("Error earning points:", pointError.message);

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

      // Reset form fields
      setTopText("");
      setBottomText("");
      setImage(null);
      setUploadTitle("");
      setCategory("");
      setMood("");
      setKeywords("");

      if (onSuccess) onSuccess("Meme added to RoastRiot! 🎉 +10 points earned!");
    } catch (err) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err.message || "Something went wrong"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const fontSize = canvas.width / 10;
      ctx.font = `bold ${fontSize}px Impact, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = "black";
      ctx.lineWidth = fontSize / 15;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (topText) {
        ctx.strokeText(topText.toUpperCase(), canvas.width / 2, fontSize);
        ctx.fillText(topText.toUpperCase(), canvas.width / 2, fontSize);
      }

      if (bottomText) {
        ctx.strokeText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
        ctx.fillText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
      }

      const link = document.createElement("a");
      link.download = "custom-meme.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = image;
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {isBlockedUser ? (
        <div className="lg:col-span-2 rounded-[1.75rem] border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          Your account is blocked, so the meme editor is read-only right now.
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="relative group">
          <input
            type="file"
            onChange={handleImageUpload}
            className="hidden"
            id="meme-upload"
            accept="image/*"
          />
          <label
            htmlFor="meme-upload"
            className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 hover:border-violet-500/50 transition-all group"
          >
            <Upload className="w-8 h-8 mb-2 text-zinc-500 group-hover:text-violet-400 transition-colors" />
            <span className="text-sm text-zinc-400">Click to upload a background image</span>
          </label>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Top Text"
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white"
            />
          </div>
          <div className="relative">
            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Bottom Text"
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white"
            />
          </div>

          <div className="flex items-center gap-4 p-2 bg-white/5 rounded-xl border border-white/10">
            <Palette className="text-zinc-500 ml-2" size={18} />
            <span className="text-sm text-zinc-400 mr-2">Color:</span>
            <div className="flex gap-2">
              {["#ffffff", "#ffff00", "#ff0000", "#00ff00", "#00ffff"].map((color) => (
                <button
                  key={color}
                  onClick={() => setTextColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${textColor === color ? "border-violet-400 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-6 h-6 bg-transparent border-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {image && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <button
              onClick={handleDownload}
              className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition"
            >
              <Download size={20} />
              Download to Device
            </button>

            <div className="space-y-3">
              <div className="relative">
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  placeholder="Meme Title (Required for upload)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white text-sm"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  placeholder="Category (e.g. Reply, Funny)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white text-sm"
                />
              </div>
              <div className="relative">
                <Smile className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  placeholder="Mood (e.g., Happy, Sad, Awkward)"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white text-sm"
                />
              </div>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  placeholder="Keywords (comma separated)"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white text-sm"
                />
              </div>
              <button
                onClick={handleUploadToHub}
                disabled={isUploading || !user || isBlockedUser}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <CloudUpload size={20} />}
                {user ? "Upload to RoastRiot.meme" : "Sign In to Upload"}
              </button>
              {!user && <p className="text-[10px] text-zinc-500 text-center mt-2">Sign in to share your creation with everyone!</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/40 p-4 min-h-[300px] overflow-hidden">
        {image ? (
          <div className="relative w-full max-w-md shadow-2xl rounded-xl overflow-hidden">
            <img src={image} alt="preview" className="w-full h-auto" />
            <h3
              className="absolute top-2 sm:top-4 left-0 right-0 px-4 text-center font-black uppercase text-lg sm:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] break-words pointer-events-none"
              style={{ color: textColor }}
            >
              {topText}
            </h3>
            <h3
              className="absolute bottom-2 sm:bottom-4 left-0 right-0 px-4 text-center font-black uppercase text-lg sm:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] break-words pointer-events-none"
              style={{ color: textColor }}
            >
              {bottomText}
            </h3>
          </div>
        ) : (
          <div className="text-center text-zinc-600">
            <ImageIcon size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">Preview will appear here</p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
