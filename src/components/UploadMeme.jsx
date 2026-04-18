import { useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  buildKeywordSuggestions,
  highlightTerms,
  getNextKeywordVariant,
  parseKeywords,
  toggleKeyword,
} from "./generate-keywords";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  RefreshCcw,
  Search,
  Smile,
  Sparkles,
  Tag,
  Type,
  Upload,
} from "lucide-react";

export default function UploadMeme({ onUpload, onSuccess, isBlockedUser = false }) {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState([]);
  const [ocrMessage, setOcrMessage] = useState("");
  const [keywordVariant, setKeywordVariant] = useState("balanced");
  const [isKeywordPanelOpen, setIsKeywordPanelOpen] = useState(true);
  const ocrCacheRef = useRef(new Map());

  const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const isValidHttpUrl = (value) => {
    try {
      const parsedUrl = new URL(value);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  };

  const currentImageKey = useMemo(() => {
    if (file) {
      return `file:${file.name}:${file.size}:${file.lastModified}`;
    }

    const url = imageUrl.trim();
    return url ? `url:${url}` : "";
  }, [file, imageUrl]);

  const parsedKeywordInput = useMemo(() => parseKeywords(keywords), [keywords]);

  const keywordLookup = useMemo(() => {
    return new Set(parsedKeywordInput.map((keyword) => keyword.toLowerCase()));
  }, [parsedKeywordInput]);

  const clearKeywordSuggestions = () => {
    setExtractedText("");
    setSuggestedKeywords([]);
    setOcrMessage("");
    setKeywordVariant("balanced");
    setIsKeywordPanelOpen(true);
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setOcrMessage("");

    if (!nextFile) {
      setFile(null);
      setImageSource("");
      clearKeywordSuggestions();
      return;
    }

    if (!nextFile.type?.startsWith("image/")) {
      alert("Please choose a valid image file.");
      return;
    }

    setFile(nextFile);
    setImageUrl("");
    clearKeywordSuggestions();

    const reader = new FileReader();
    reader.onload = () => {
      setImageSource(String(reader.result || ""));
    };
    reader.onerror = () => {
      setImageSource("");
      alert("Could not read the selected image file.");
    };
    reader.readAsDataURL(nextFile);
  };

  const handleImageUrlChange = (event) => {
    const nextValue = event.target.value;
    setImageUrl(nextValue);
    setOcrMessage("");

    if (nextValue.trim()) {
      setFile(null);
      setImageSource(nextValue.trim());
      clearKeywordSuggestions();
      return;
    }

    setImageSource("");
    clearKeywordSuggestions();
  };

  const resetOcrFromCache = (cacheEntry, cacheKey, nextVariant = keywordVariant) => {
    const text = String(cacheEntry?.rawText || "").trim();

    if (!text) {
      setExtractedText("");
      setSuggestedKeywords([]);
      setOcrMessage("No text detected in image");
      ocrCacheRef.current.set(cacheKey, {
        rawText: "",
        keywords: [],
        variant: nextVariant,
      });
      return [];
    }

    const nextKeywords = buildKeywordSuggestions(text, {
      maxKeywords: 8,
      variant: nextVariant,
    });

    const nextCache = {
      rawText: text,
    };

    ocrCacheRef.current.set(cacheKey, nextCache);
    setExtractedText(text);
    setSuggestedKeywords(nextKeywords);
    setOcrMessage("");
    setIsKeywordPanelOpen(true);

    return nextKeywords;
  };

  const fetchKeywordSuggestions = async ({ forceRefresh = false } = {}) => {
    const source = imageSource.trim();

    if (!source) {
      setOcrMessage("Select an image first to generate keywords.");
      return;
    }

    const cacheKey = currentImageKey || source;
    const cached = ocrCacheRef.current.get(cacheKey);

    if (cached && !forceRefresh) {
      setKeywordVariant(cached.variant || keywordVariant);
      resetOcrFromCache(cached, cacheKey, cached.variant || keywordVariant);
      return;
    }

    setOcrLoading(true);
    setOcrMessage("");

    try {
      const response = await fetch("/api/ocr-keywords", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          imageSource: source,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to extract text from the image.");
      }

      const rawText = String(payload?.text || "").trim();
      const nextVariant = forceRefresh
        ? keywordVariant === "balanced"
          ? "expanded"
          : "balanced"
        : keywordVariant;

      if (!rawText) {
        setExtractedText("");
        setSuggestedKeywords([]);
        setOcrMessage("No text detected in image");
        ocrCacheRef.current.set(cacheKey, {
          rawText: "",
        });
        return;
      }

      const nextKeywords = buildKeywordSuggestions(rawText, {
        maxKeywords: 8,
        variant: nextVariant,
      });

      const nextCache = {
        rawText,
      };

      ocrCacheRef.current.set(cacheKey, nextCache);
      setExtractedText(rawText);
      setSuggestedKeywords(nextKeywords);
      setKeywordVariant(nextVariant);
      setIsKeywordPanelOpen(true);
    } catch (error) {
      console.error("Keyword suggestion failed:", error);
      setOcrMessage(error.message || "OCR failed. Please try again.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRegenerateKeywords = async () => {
    const source = imageSource.trim();
    if (!source) {
      setOcrMessage("Select an image first to generate keywords.");
      return;
    }

    const cacheKey = currentImageKey || source;
    const cached = ocrCacheRef.current.get(cacheKey);

    if (cached?.rawText) {
      const nextVariant = getNextKeywordVariant(keywordVariant);
      setOcrLoading(true);
      setKeywordVariant(nextVariant);
      setOcrMessage("");
      setSuggestedKeywords(
        buildKeywordSuggestions(cached.rawText, {
          maxKeywords: 10,
          variant: nextVariant,
        })
      );
      setExtractedText(cached.rawText);
      setIsKeywordPanelOpen(true);
      ocrCacheRef.current.set(cacheKey, { rawText: cached.rawText });
      setOcrLoading(false);
      return;
    }

    await fetchKeywordSuggestions({ forceRefresh: true });
  };

  const handleKeywordToggle = (keyword) => {
    setKeywords((current) => toggleKeyword(current, keyword));
  };

  const handleUpload = async () => {
    if (isBlockedUser) {
      return alert("Your account is blocked from uploading memes.");
    }

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
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

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

      const { error: profileGuardError } = await supabase.from("profiles").upsert(
        {
          id: currentUser.id,
          username: currentUser.user_metadata?.username || title.split(" ")[0] || "User",
          points: 0,
        },
        { onConflict: "id" }
      );
      if (profileGuardError) console.warn("Profile sync warning:", profileGuardError.message);

      const slug = `${generateSlug(title)}-${Math.random().toString(36).substring(2, 7)}`;

      const payload = {
        title: title.trim(),
        slug,
        image_url: cloudData.secure_url,
        category: category.trim(),
        mood: mood.trim(),
        keywords: parsedKeywordInput,
        user_id: currentUser.id,
      };

      const { data: savedMeme, error } = await supabase
        .from("meme-table")
        .insert([payload])
        .select("*")
        .single();

      if (error) throw error;

      const { error: pointError } = await supabase.rpc("increment_points", { amount: 10 });
      if (pointError) console.error("Error earning points:", pointError.message);

      setFile(null);
      setImageUrl("");
      setImageSource("");
      setTitle("");
      setCategory("");
      setMood("");
      setKeywords("");
      clearKeywordSuggestions();

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

  const hasSuggestions = suggestedKeywords.length > 0;
  const hasExtractedText = Boolean(extractedText.trim());
  const canSuggest = Boolean(imageSource.trim()) && !ocrLoading && !loading;
  const keywordButtonLabel = ocrLoading
    ? "Extracting..."
    : hasExtractedText
    ? "Regenerate keywords"
    : "Suggest AI Keywords";
  const handlePrimaryKeywordAction = () => {
    if (hasExtractedText) {
      handleRegenerateKeywords();
      return;
    }

    fetchKeywordSuggestions({ forceRefresh: Boolean(ocrMessage) });
  };

  return (
    <div className="space-y-6 pb-2">
      <div className="space-y-2">
        <label htmlFor="file-upload" className="block text-sm font-medium text-zinc-300">
          Image File
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full cursor-pointer text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-violet-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white transition-colors hover:file:bg-violet-600"
        />
        {file ? <p className="text-xs text-zinc-500">Selected: {file.name}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Link2 size={18} className="block shrink-0 leading-none" />
          </div>
          <input
            type="url"
            placeholder="Paste direct image URL here"
            value={imageUrl}
            onChange={handleImageUrlChange}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition placeholder-zinc-500 focus:border-violet-500/50"
          />
        </div>
        <p className="text-xs text-zinc-500">
          Use a direct image link, not the Google Images results page.
        </p>
      </div>

      <div className="relative">
        <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Meme Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition placeholder-zinc-500 focus:border-violet-500/50"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Category (e.g. Reply, Funny)"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition placeholder-zinc-500 focus:border-violet-500/50"
        />
      </div>

      <div className="relative">
        <Smile className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          placeholder="Mood (e.g., Happy, Sad, Awkward)"
          value={mood}
          onChange={(event) => setMood(event.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition placeholder-zinc-500 focus:border-violet-500/50"
        />
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              placeholder="Keywords (comma separated)"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition placeholder-zinc-500 focus:border-violet-500/50"
            />
          </div>

          <button
            type="button"
            onClick={handlePrimaryKeywordAction}
            disabled={!canSuggest}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ocrLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : hasExtractedText ? (
              <>
                <RefreshCcw size={16} />
              </>
            ) : (
              <Sparkles size={16} />
            )}
            {keywordButtonLabel}
          </button>
        </div>

        {ocrMessage ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <AlertCircle className="mt-0.5 shrink-0" size={16} />
            <span>{ocrMessage}</span>
          </div>
        ) : null}

        {hasSuggestions && isKeywordPanelOpen ? (
          <div className="space-y-4 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Suggested keywords
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateKeywords}
                  disabled={!canSuggest}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw size={13} />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => setIsKeywordPanelOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                  aria-label="Hide keyword suggestions"
                >
                  <ChevronUp size={13} />
                  Hide
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestedKeywords.map((keyword) => {
                const keywordKey = keyword.toLowerCase();
                const isSelected = keywordLookup.has(keywordKey);

                return (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => handleKeywordToggle(keyword)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-50"
                        : "border-white/10 bg-white/5 text-zinc-200 hover:border-violet-400/30 hover:bg-violet-500/10"
                    }`}
                  >
                    {keyword}
                  </button>
                );
              })}
            </div>

            {extractedText ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Extracted text preview
                </p>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-200">
                  {highlightTerms(extractedText, suggestedKeywords).map((segment, index) =>
                    segment.matched ? (
                      <mark
                        key={`${segment.text}-${index}`}
                        className="rounded-md bg-violet-400/20 px-1.5 py-0.5 font-semibold text-violet-100"
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={`${segment.text}-${index}`}>{segment.text}</span>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasSuggestions && !isKeywordPanelOpen ? (
          <button
            type="button"
            onClick={() => setIsKeywordPanelOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <div>
              <p className="text-sm font-semibold text-white">Keyword suggestions hidden</p>
              <p className="text-xs text-zinc-400">
                {suggestedKeywords.length} suggestion{suggestedKeywords.length === 1 ? "" : "s"} ready
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-zinc-200">
              <ChevronDown size={13} />
              Show
            </span>
          </button>
        ) : null}
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || isBlockedUser}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Uploading...
          </>
        ) : (
          <>
            <Upload size={20} />
            Upload Meme
          </>
        )}
      </button>

      {isBlockedUser ? (
        <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          Your account is blocked, so uploads are disabled. Please contact an admin if you think
          this is a mistake.
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 text-sm text-zinc-300">
        <p className="font-semibold text-white">Keyword helper</p>
        <p className="mt-2 text-zinc-400">
          Click keyword chips to add or remove them. Use Regenerate to cycle through different OCR
          keyword styles if the first set feels too plain.
        </p>
      </div>
    </div>
  );
}
