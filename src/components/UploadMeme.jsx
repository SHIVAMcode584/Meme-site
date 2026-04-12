import { useState } from "react";
import { Upload, Type, CheckCircle2, Loader2 } from "lucide-react";

function UploadMeme({ onUpload, onSuccess }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Select image first!");
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    // 1. Make sure 'meme_upload' is an UNSIGNED preset in your Cloudinary settings
    formData.append("upload_preset", "meme_upload"); 

    try {
      // 2. REPLACE 'YOUR_CLOUD_NAME' with your actual Cloudinary cloud name
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dntclntau/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Upload failed");
      }

      const data = await res.json();

      const newMeme = {
        id: Date.now(),
        title: title || "Untitled Meme",
        image: data.secure_url,
        category: "User",
        mood: "Custom",
        keywords: ["user-upload", (title || "").toLowerCase()],
      };

      onUpload(newMeme);
      setFile(null);
      setTitle("");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Cloudinary Error:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative group">
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files[0])} 
          className="hidden"
          id="file-upload"
          accept="image/*"
        />
        <label
          htmlFor="file-upload"
          className={`flex flex-col items-center justify-center w-full h-40 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            file ? "border-green-500/50 bg-green-500/5" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50"
          }`}
        >
          {file ? (
            <>
              <CheckCircle2 className="w-10 h-10 mb-2 text-green-400" />
              <span className="text-sm text-green-300 font-medium">{file.name}</span>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mb-2 text-zinc-500" />
              <span className="text-sm text-zinc-400">Click to select your meme image</span>
            </>
          )}
        </label>
      </div>

      <div className="relative">
        <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          type="text"
          placeholder="Give your meme a title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={isUploading || !file}
        className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition shadow-lg shadow-violet-500/20"
      >
        {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
        {isUploading ? "Uploading..." : "Publish Meme"}
      </button>
    </div>
  );
}
export default UploadMeme;