import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  Image as ImageIcon,
  Loader2,
  Layers3,
  Move,
  Palette,
  Plus,
  Minus,
  Trash2,
  Type,
  Sparkles,
  Wand2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { buildMemeSlug, insertMemeWithSlugFallback } from "../utils/memePersistence";

const FONT_OPTIONS = [
  "Impact",
  "Arial",
  "Georgia",
  "Trebuchet MS",
  "Comic Sans MS",
  "Times New Roman",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildLayer(kind, overrides = {}) {
  return {
    id: kind,
    label:
      kind === "top" ? "Top text" : kind === "bottom" ? "Bottom text" : "Text box",
    text: "",
    x: 50,
    y: kind === "top" ? 15 : kind === "bottom" ? 85 : 50,
    size: 0.09,
    fontFamily: "Impact",
    color: "#ffffff",
    outlineColor: "#000000",
    outlineWidth: 0.12,
    removable: kind !== "top" && kind !== "bottom",
    placeholderText:
      kind === "top"
        ? "Type top text"
        : kind === "bottom"
        ? "Type bottom text"
        : "Type text here",
    ...overrides,
  };
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\s,]+/).filter(Boolean);
}

function formatStoredKeywords(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  return "";
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = source;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function sampleAverageColor(ctx, boxX, boxY, boxWidth, boxHeight, padding = 16) {
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas;
  const regions = [
    [boxX, boxY - padding, boxWidth, padding],
    [boxX, boxY + boxHeight, boxWidth, padding],
    [boxX - padding, boxY, padding, boxHeight],
    [boxX + boxWidth, boxY, padding, boxHeight],
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  regions.forEach(([x, y, regionWidth, regionHeight]) => {
    const startX = clamp(x, 0, canvasWidth);
    const startY = clamp(y, 0, canvasHeight);
    const endX = clamp(x + regionWidth, 0, canvasWidth);
    const endY = clamp(y + regionHeight, 0, canvasHeight);
    const width = Math.floor(endX - startX);
    const height = Math.floor(endY - startY);

    if (width <= 0 || height <= 0) return;

    const pixels = ctx.getImageData(startX, startY, width, height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha === 0) continue;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      count += 1;
    }
  });

  if (!count) {
    return "rgba(0, 0, 0, 0.88)";
  }

  return `rgba(${clampByte(r / count)}, ${clampByte(g / count)}, ${clampByte(b / count)}, 0.94)`;
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [""];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];

  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const nextWord = words[i];
    const testLine = `${current} ${nextWord}`;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && current) {
      lines.push(current);
      current = nextWord;
    } else {
      current = testLine;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

async function composeMemeBlob(source, layers, canvasRef) {
  const canvas = canvasRef.current;
  if (!canvas) throw new Error("Canvas is not ready");

  const image = await loadImage(source);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  layers.forEach((layer) => {
    const rawText = String(layer.text || "").trim();
    const fontSize = Math.max(24, canvas.width * layer.size);
    const fontFamily = layer.fontFamily.includes(" ")
      ? `"${layer.fontFamily}"`
      : layer.fontFamily;
    const placeholderText =
      layer.placeholderText ||
      (layer.id === "top"
        ? "TYPE TOP TEXT"
        : layer.id === "bottom"
        ? "TYPE BOTTOM TEXT"
        : `TYPE ${String(layer.label || "TEXT BOX").toUpperCase()}`);
    const text = (rawText || placeholderText).toUpperCase();
    const x = clamp((layer.x / 100) * canvas.width, 0, canvas.width);
    const y = clamp((layer.y / 100) * canvas.height, 0, canvas.height);
    const maxWidth = canvas.width * 0.8;

    ctx.font = `900 ${fontSize}px ${fontFamily}, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = layer.outlineColor;
    ctx.lineWidth = Math.max(2, fontSize * layer.outlineWidth);

    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.08;
    const totalHeight = lines.length * lineHeight;
    const boxPaddingX = fontSize * 0.45;
    const boxPaddingY = fontSize * 0.3;
    const measuredWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    const boxWidth = Math.min(canvas.width * 0.9, measuredWidth + boxPaddingX * 2);
    const boxHeight = totalHeight + boxPaddingY * 2;

    const startY = y - totalHeight / 2 + lineHeight / 2;
    const boxX = x - boxWidth / 2;
    const boxY = y - boxHeight / 2;

    ctx.fillStyle = sampleAverageColor(ctx, boxX, boxY, boxWidth, boxHeight, fontSize * 0.2);
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, fontSize * 0.2);
    ctx.fill();

    if (rawText) {
      ctx.fillStyle = layer.color;

      lines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        ctx.strokeText(line, x, lineY);
        ctx.fillText(line, x, lineY);
      });
    }
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export the meme image"));
      },
      "image/png",
      1
    );
  });
}

export default function MemeEditor({
  user,
  onUpload,
  onSuccess,
  isBlockedUser = false,
  initialMeme = null,
  remixMode = false,
  isModal = false,
}) {
  const isRemixEditor = Boolean(remixMode || initialMeme);
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSourceLoading, setIsSourceLoading] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [selectedLayerId, setSelectedLayerId] = useState("top");
  const [textLayers, setTextLayers] = useState([
    buildLayer("top"),
    buildLayer("bottom"),
  ]);
  const uploadInputId = useId();
  const canvasRef = useRef(null);
  const imageInputRef = useRef(null);
  const previewRef = useRef(null);
  const dragStateRef = useRef(null);
  const customLayerCountRef = useRef(0);

  useEffect(() => {
    const nextSource = initialMeme?.image_url || initialMeme?.image || "";

    setSourceUrl(nextSource);
    setFile(null);
    setUploadTitle(
      initialMeme?.title
        ? `${initialMeme.title} Remix`
        : isRemixEditor
        ? "My Remix"
        : ""
    );
    setCategory(initialMeme?.category || "");
    setMood(initialMeme?.mood || "");
    setKeywords(formatStoredKeywords(initialMeme?.keywords));
    customLayerCountRef.current = 0;
    setTextLayers([
      buildLayer("top", { text: "" }),
      buildLayer("bottom", { text: "" }),
    ]);
    setSelectedLayerId("top");
    setIsSourceLoading(Boolean(nextSource));
  }, [initialMeme, isRemixEditor]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return undefined;

    const updateWidth = () => setPreviewWidth(element.clientWidth || 0);
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const stopDragging = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const previewFontSize = useMemo(() => {
    return (layer) => Math.max(18, previewWidth * layer.size);
  }, [previewWidth]);

  const applyLayerChange = (layerId, patch) => {
    setTextLayers((current) =>
      current.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer))
    );
  };

  const createCustomLayer = () => {
    customLayerCountRef.current += 1;
    const index = customLayerCountRef.current;

    return buildLayer("custom", {
      id: `custom-${Date.now()}-${index}`,
      label: `Text box ${index}`,
      text: "",
      x: 50,
      y: 50,
      removable: true,
      placeholderText: `Type text box ${index}`,
    });
  };

  const handleAddTextLayer = () => {
    const nextLayer = createCustomLayer();
    setTextLayers((current) => [...current, nextLayer]);
    setSelectedLayerId(nextLayer.id);
  };

  const handleRemoveTextLayer = (layerId) => {
    if (layerId === "top" || layerId === "bottom") return;

    setTextLayers((current) => current.filter((layer) => layer.id !== layerId));
    setSelectedLayerId((current) => (current === layerId ? "top" : current));
  };

  const handlePointerDown = (layerId, event) => {
    if (!previewRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layerId);

    const rect = previewRef.current.getBoundingClientRect();
    dragStateRef.current = {
      layerId,
      rect,
    };

    const handleMove = (moveEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.layerId !== layerId) return;

      const { left, top, width, height } = dragState.rect;
      const nextX = clamp(((moveEvent.clientX - left) / width) * 100, 4, 96);
      const nextY = clamp(((moveEvent.clientY - top) / height) * 100, 6, 94);

      setTextLayers((current) =>
        current.map((layer) =>
          layer.id === layerId ? { ...layer, x: nextX, y: nextY } : layer
        )
      );
    };

    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleImageUpload = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    if (!nextFile.type?.startsWith("image/")) {
      alert("Please choose a valid image file.");
      return;
    }

    setFile(nextFile);
    setIsSourceLoading(true);

    const reader = new FileReader();
    reader.onload = () => {
      setSourceUrl(String(reader.result || ""));
    };
    reader.onerror = () => {
      setIsSourceLoading(false);
      alert("Could not read the selected image file.");
    };
    reader.readAsDataURL(nextFile);
  };

  const handleClearImage = () => {
    setFile(null);
    setSourceUrl("");
    setIsSourceLoading(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const updateLayerText = (layerId, text) => {
    applyLayerChange(layerId, { text });
  };

  const updateLayerSize = (layerId, size) => {
    applyLayerChange(layerId, { size: clamp(size, 0.045, 0.2) });
  };

  const updateLayerFont = (layerId, fontFamily) => {
    applyLayerChange(layerId, { fontFamily });
  };

  const updateLayerColor = (layerId, color) => {
    applyLayerChange(layerId, { color });
  };

  const updateLayerOutline = (layerId, outlineWidth) => {
    applyLayerChange(layerId, { outlineWidth: clamp(outlineWidth, 0.05, 0.22) });
  };

  const handlePreviewDownload = async () => {
    if (!sourceUrl) return;

    try {
      const blob = await composeMemeBlob(sourceUrl, textLayers, canvasRef);
      const previewUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = previewUrl;
      link.download = `${uploadTitle.trim() || "meme"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(previewUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert(error.message || "Unable to download this meme right now.");
    }
  };

  const saveMeme = async ({ originalMemeId = null, successMessage }) => {
    if (isBlockedUser) {
      alert("Your account is blocked from saving memes.");
      return;
    }

    if (!user) {
      alert("Please sign in to save memes!");
      return;
    }

    if (!uploadTitle.trim()) {
      alert("Please add a meme title first.");
      return;
    }

    if (!sourceUrl) {
      alert("Please choose an image first.");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error("Please log in again before saving.");
      }

      const blob = await composeMemeBlob(sourceUrl, textLayers, canvasRef);

      const formData = new FormData();
      formData.append("file", blob, "meme.png");
      formData.append("upload_preset", "meme_upload");

      const response = await fetch("https://api.cloudinary.com/v1_1/dntclntau/image/upload", {
        method: "POST",
        body: formData,
      });

      const cloudData = await response.json();
      if (!response.ok || !cloudData.secure_url) {
        throw new Error(cloudData?.error?.message || "Cloudinary upload failed");
      }

      const { error: profileGuardError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: currentUser.id,
            username: currentUser.user_metadata?.username || uploadTitle.split(" ")[0] || "User",
            points: 0,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

      if (profileGuardError) {
        console.warn("Profile sync warning:", profileGuardError.message);
      }

      const slug = buildMemeSlug(uploadTitle);

      const payload = {
        title: uploadTitle.trim(),
        slug,
        image_url: cloudData.secure_url,
        user_id: currentUser.id,
        category: category.trim(),
        mood: mood.trim(),
        keywords: normalizeKeywords(keywords).join(", "),
        top_text: textLayers.find((layer) => layer.id === "top")?.text?.trim() || null,
        bottom_text: textLayers.find((layer) => layer.id === "bottom")?.text?.trim() || null,
        original_meme_id: originalMemeId,
      };

      const { data: savedMeme, error } = await insertMemeWithSlugFallback(
        supabase,
        payload,
        "*, profiles(username)"
      );

      if (error) throw error;

      const savedPayload = {
        ...savedMeme,
        image: savedMeme?.image_url || cloudData.secure_url,
      };

      onUpload?.(savedPayload);
      onSuccess?.(successMessage);

      if (!isRemixEditor) {
        setFile(null);
        setSourceUrl("");
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert(`Save failed: ${error.message || "Something went wrong"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSave = async () => {
    if (!sourceUrl) {
      alert("Please choose an image first.");
      return;
    }

    if (!user) {
      alert("Please sign in to upload memes!");
      return;
    }

    await saveMeme({
      originalMemeId: null,
      successMessage: "Meme added successfully! +10 points earned!",
    });
  };

  const handleRemixSave = async () => {
    if (!initialMeme?.id) {
      alert("Please choose a meme to remix first.");
      return;
    }

    await saveMeme({
      originalMemeId: initialMeme.id,
      successMessage: "Remix saved successfully! +10 points earned!",
    });
  };

  const canSave = Boolean(
    sourceUrl &&
      uploadTitle.trim() &&
      !isSaving &&
      !isBlockedUser &&
      user &&
      (!isRemixEditor || initialMeme?.id)
  );

  const activeLayer = textLayers.find((layer) => layer.id === selectedLayerId) || textLayers[0];
  const filledLayerCount = textLayers.filter((layer) => String(layer.text || "").trim()).length;
  const customLayerCount = textLayers.filter((layer) => layer.removable).length;
  const previewStatus = sourceUrl
    ? isRemixEditor
      ? "Remix source loaded"
      : file
      ? "Uploaded image ready"
      : "Image ready"
    : isRemixEditor
    ? "Pick a meme from the feed"
    : "Upload an image to begin";

  return (
    <div
      className={`grid gap-6 ${
        isModal
          ? "lg:grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
          : "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
      } lg:items-start`}
    >
      <div className="order-2 min-w-0 lg:order-1">
        <div
          className={`space-y-6 overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/15 backdrop-blur-sm ${
            isModal ? "px-2 py-6 sm:px-6 lg:p-7" : "px-3 py-6 sm:p-7 lg:p-9"
          }`}
        >
          {isRemixEditor ? (
            <div
              className={`overflow-hidden border border-violet-500/20 bg-violet-500/[0.02] shadow-inner shadow-black/10 ${
                isModal ? "rounded-[1.6rem] p-4" : "rounded-[2rem] p-5"
              }`}
            >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200 ${
                    isModal ? "px-3 py-1" : "px-4 py-1.5"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Remix workspace
                </div>
                <div className="min-w-0">
                  <h2 className={`${isModal ? "text-xl sm:text-[1.35rem]" : "text-2xl"} font-black tracking-tight text-white`}>
                    {isRemixEditor ? "Shape the remix" : "Build a new meme"}
                  </h2>
                  {isModal ? (
                    <p className="mt-1 max-w-xl text-sm text-zinc-400">
                      Preview, edit, and save from one screen.
                    </p>
                  ) : (
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                      Tune captions, adjust the source image, and publish a clean new version
                      without touching the original post.
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`shrink-0 rounded-2xl border border-white/5 bg-black/40 text-right ${
                  isModal ? "px-4 py-3" : "px-5 py-4"
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  Active layer
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{activeLayer?.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{previewStatus}</p>
              </div>
            </div>

            <div className={`flex flex-wrap gap-2 ${isModal ? "mt-3" : "mt-4"}`}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <CheckCircle2 size={14} className="text-emerald-300" />
                {filledLayerCount} filled caption{filledLayerCount === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <Layers3 size={14} className="text-violet-300" />
                {customLayerCount} extra text box{customLayerCount === 1 ? "" : "es"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <Move size={14} className="text-cyan-300" />
                Drag text directly on the preview
              </div>
            </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-5 shadow-inner shadow-black/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Meme studio
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    Build a new meme
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                    Upload a source, place captions with more control, and keep the export flow
                    quick enough to stay playful.
                  </p>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/5 bg-black/40 px-5 py-4 text-right">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  Active layer
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{activeLayer?.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{previewStatus}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <CheckCircle2 size={14} className="text-emerald-300" />
                {filledLayerCount} filled caption{filledLayerCount === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <Layers3 size={14} className="text-violet-300" />
                {customLayerCount} extra text box{customLayerCount === 1 ? "" : "es"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-200">
                <Move size={14} className="text-cyan-300" />
                Drag text directly on the preview
              </div>
            </div>
            </div>
          )}

          {isBlockedUser ? (
            <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-medium text-amber-200">
              Your account is blocked, so the meme editor is read-only right now.
            </div>
          ) : null}

          {isRemixEditor && initialMeme ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-violet-200/80">
              Erase and replace
            </p>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              <img
                src={initialMeme.image || initialMeme.image_url}
                alt={initialMeme.title}
                className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{initialMeme.title}</p>
                <p className="text-xs leading-5 text-zinc-300">
                  Start with blank boxes. The export will cover the old caption area and draw your
                  new text on top.
                </p>
              </div>
            </div>
            </div>
          ) : null}

          {!isRemixEditor ? (
            <div className="group relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.02] p-5 shadow-2xl shadow-black/10">
            <input
              ref={imageInputRef}
              type="file"
              onChange={handleImageUpload}
              className="hidden"
              id={uploadInputId}
              accept="image/*"
              disabled={isBlockedUser}
            />
            <label
              htmlFor={uploadInputId}
              className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-white/10 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.15),transparent_45%),rgba(5,7,13,0.65)] px-6 py-8 text-center transition-all duration-300 hover:border-violet-500/50 hover:bg-white/[0.04]"
            >
              <CloudUpload className="mb-3 h-8 w-8 text-zinc-500 transition-colors group-hover:text-violet-400" />
              <span className="text-sm font-semibold text-white">Click to upload a background image</span>
              <span className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
                PNG, JPG, and WebP all work. Pick the sharpest version you have for the cleanest
                export.
              </span>
            </label>
            {file ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  <CheckCircle2 size={14} />
                  <span className="truncate">Selected file: {file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                >
                  <Trash2 size={13} />
                  Remove image
                </button>
              </div>
            ) : null}
            </div>
          ) : null}

          <div
            className={`overflow-hidden space-y-4 rounded-[2rem] border border-white/10 bg-transparent ${
              isModal ? "px-1.5 py-4 sm:p-5" : "p-5 sm:p-6"
            }`}
          >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Layers3 className="text-violet-300" size={18} />
              <div className="min-w-0">
                <h3 className="text-lg font-bold">Text boxes</h3>
                <p className="text-xs leading-5 text-zinc-500">
                  Drag, resize, and style each caption separately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddTextLayer}
              disabled={isBlockedUser}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10 hover:border-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} />
              Add text box
            </button>
          </div>

          <p className="max-w-2xl text-[13px] leading-6 text-zinc-400">
            Top and bottom boxes are included by default. Add more text boxes whenever you need a
            caption in a different spot.
          </p>

          <div className="grid gap-3">
            {textLayers.map((layer) => {
              const isActive = selectedLayerId === layer.id;
              return (
                <div
                  key={layer.id}
                  className={`min-w-0 overflow-hidden rounded-[1.75rem] border transition-all duration-300 ${isModal ? "px-2 py-4 sm:p-5" : "p-4 sm:p-6"} ${
                    isActive
                      ? "border-violet-500/60 bg-violet-500/5 shadow-xl shadow-violet-500/5"
                      : "border-transparent bg-transparent hover:border-white/10"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedLayerId(layer.id)}
                      className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-white"
                    >
                      <Move size={16} className={`shrink-0 ${isActive ? 'text-violet-400' : 'text-zinc-500'}`} />
                      <span className="truncate">{layer.label}</span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-zinc-500">
                        Drag on preview
                      </span>
                      {layer.removable ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveTextLayer(layer.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[10px] font-bold text-red-400 transition hover:bg-red-500/15"
                          aria-label={`Remove ${layer.label}`}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      ) : (
                        <span className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
                          Required
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                        Caption
                      </span>
                      <input
                        type="text"
                        placeholder={`Edit ${layer.label.toLowerCase()}`}
                        value={layer.text}
                        onChange={(event) => updateLayerText(layer.id, event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                          Font
                        </label>
                        <select
                          value={layer.fontFamily}
                          onChange={(event) => updateLayerFont(layer.id, event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition focus:border-violet-500/50"
                        >
                          {FONT_OPTIONS.map((font) => (
                            <option key={font} value={font} className="bg-[#0d1220]">
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                          Size
                        </label>
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => updateLayerSize(layer.id, layer.size - 0.01)}
                            className="rounded-lg border border-white/10 bg-black/40 p-2 text-zinc-300 transition hover:bg-white/5"
                            aria-label="Decrease text size"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="range"
                            min="0.045"
                            max="0.2"
                            step="0.005"
                            value={layer.size}
                            onChange={(event) =>
                              updateLayerSize(layer.id, Number(event.target.value))
                            }
                            className="h-2 w-full accent-violet-400"
                          />
                          <button
                            type="button"
                            onClick={() => updateLayerSize(layer.id, layer.size + 0.01)}
                            className="rounded-lg border border-white/10 bg-black/40 p-2 text-zinc-300 transition hover:bg-white/5"
                            aria-label="Increase text size"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                        Outline
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.22"
                        step="0.01"
                        value={layer.outlineWidth}
                        onChange={(event) =>
                          updateLayerOutline(layer.id, Number(event.target.value))
                        }
                        className="h-2 w-full accent-fuchsia-400"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Palette size={16} className="text-zinc-500" />
                      {["#ffffff", "#fef08a", "#fda4af", "#86efac", "#93c5fd"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateLayerColor(layer.id, color)}
                          className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                            layer.color === color ? "border-violet-400" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Set ${layer.label} color`}
                        />
                      ))}
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(event) => updateLayerColor(layer.id, event.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-full border border-white/10 bg-transparent p-0 overflow-hidden"
                        aria-label={`${layer.label} custom color`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          <div
            className={`flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.02] shadow-2xl shadow-black/10 sm:flex-row ${
              isModal ? "p-5" : "p-6"
            }`}
          >
          <button
            type="button"
            onClick={handlePreviewDownload}
            disabled={!sourceUrl || isSaving}
            className="inline-flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={20} />
            Download preview
          </button>

          <button
            type="button"
            onClick={isRemixEditor ? handleRemixSave : handleCreateSave}
            disabled={!canSave}
            className="inline-flex h-16 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black text-white shadow-xl shadow-violet-500/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CloudUpload size={20} />}
            {isSaving
              ? "Saving..."
              : isRemixEditor
              ? "Save Remix"
              : user
              ? "Upload Meme"
              : "Sign In to Upload"}
          </button>
          </div>

          {!user ? (
            <p className="text-center text-xs text-zinc-500">
              Sign in before saving, and your edited meme will be added without overwriting the
              source meme.
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={`order-1 min-w-0 space-y-4 lg:order-2 ${
          isModal ? "lg:sticky lg:top-4 lg:self-start" : "lg:sticky lg:top-6 lg:self-start"
        }`}
      >
        <div
          className={`overflow-hidden rounded-[2.15rem] border border-white/10 bg-black/40 shadow-2xl shadow-black/20 backdrop-blur-md ${
            isModal ? "p-4" : "p-5"
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Live preview
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Drag captions around, then save the edited image as a new meme.
              </p>
            </div>
            {isSourceLoading ? (
              <Loader2 className="animate-spin text-violet-400" size={18} />
            ) : null}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
              <CheckCircle2 size={13} className={sourceUrl ? "text-emerald-400" : "text-zinc-600"} />
              {previewStatus}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
              <Move size={13} className="text-cyan-400" />
              Selected: {activeLayer?.label}
            </div>
            {!isRemixEditor && sourceUrl ? (
              <button
                type="button"
                onClick={handleClearImage}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <Trash2 size={13} />
                Remove image
              </button>
            ) : null}
          </div>

          <div
            ref={previewRef}
            className={`relative w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#020617] shadow-[0_30px_80px_rgba(0,0,0,0.5)] aspect-[4/5] sm:aspect-[4/4] lg:aspect-[4/3] ${
              isModal
                ? "min-h-[280px] sm:min-h-[340px] lg:min-h-[360px] max-h-[54vh]"
                : "min-h-[320px] sm:min-h-[450px] max-h-[72vh]"
            }`}
          >
            {sourceUrl ? (
              <>
                <img
                  src={sourceUrl}
                  alt={initialMeme?.title || "Meme preview"}
                  className="h-full w-full select-none object-contain"
                  draggable={false}
                  onLoad={() => {
                    setIsSourceLoading(false);
                  }}
                  onError={() => {
                    setIsSourceLoading(false);
                    alert("Unable to preview this image.");
                  }}
                />

                <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-zinc-200 backdrop-blur-md">
                  Drag text to reposition
                </div>

                {textLayers.map((layer) => {
                  const isSelected = selectedLayerId === layer.id;
                  const fontSize = previewFontSize(layer);
                  const outlineSize = Math.max(1, fontSize * layer.outlineWidth * 0.7);

                  return (
                    <div
                      key={layer.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => handlePointerDown(layer.id, event)}
                      onFocus={() => setSelectedLayerId(layer.id)}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`absolute z-20 flex max-w-[88%] cursor-grab select-none items-center justify-center rounded-2xl border border-white/10 bg-black/70 px-4 py-2 text-center uppercase leading-none shadow-lg shadow-black/30 transition duration-200 active:cursor-grabbing ${
                        isSelected ? "ring-2 ring-violet-400/80 ring-offset-2 ring-offset-black/30" : ""
                      }`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        transform: "translate(-50%, -50%)",
                        fontFamily: layer.fontFamily,
                        fontSize: `${fontSize}px`,
                        color: layer.color,
                        textShadow: "0 2px 8px rgba(0, 0, 0, 0.75)",
                        WebkitTextStroke: `${outlineSize}px ${layer.outlineColor}`,
                        paintOrder: "stroke fill",
                      }}
                      >
                        <span className="break-words font-black">
                          {(layer.text || layer.placeholderText || "Type text").toUpperCase()}
                        </span>
                      </div>
                  );
                })}

                {!textLayers.some((layer) => String(layer.text || "").trim()) ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-zinc-300 backdrop-blur-md">
                      Add text to cover and replace the old caption area
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-zinc-600">
                <div>
                  <ImageIcon size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold text-zinc-400">
                    {isRemixEditor ? "Remix preview will appear here" : "Preview will appear here"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {isRemixEditor
                      ? "Choose a meme from the feed to preload it into this editor."
                      : "Pick an image to start building your meme."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isRemixEditor ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
            <p className="font-semibold text-white">Remix safety</p>
            <p className="mt-2 text-zinc-400">
              Saving creates a brand new meme row with `original_meme_id` set to the meme you
              started from. The original post stays untouched.
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={`order-3 min-w-0 space-y-4 lg:order-3 ${
          isModal ? "lg:col-span-1 lg:col-start-1" : "lg:col-span-2"
        }`}
      >
        <div
          className={`overflow-hidden space-y-5 rounded-[2.2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/10 backdrop-blur-sm ${
            isModal ? "px-2 py-6 sm:p-5 lg:p-6" : "px-3 py-6 sm:p-7"
          }`}
        >
          <div className="flex items-start gap-3">
            <Wand2 className="shrink-0 text-violet-300" size={18} />
            <h3 className="text-lg font-bold">Meme details</h3>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Title</label>
              <div className="relative">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Meme title"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Category
            </label>
            <div className="relative">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                placeholder="Category (e.g. Reply, Funny)"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Mood</label>
              <div className="relative">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                placeholder="Mood (e.g., Happy, Sad, Awkward)"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Keywords
            </label>
            <div className="relative">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                placeholder="Keywords (comma separated)"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
              </div>
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
