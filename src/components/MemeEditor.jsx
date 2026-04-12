import { useState, useRef } from "react";
import { Download, Upload, Image as ImageIcon, Type } from "lucide-react";

export default function MemeEditor() {
  const [image, setImage] = useState(null);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = image;
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);

      // Styling the text (Impact is the classic meme font)
      const fontSize = canvas.width / 10;
      ctx.font = `bold ${fontSize}px Impact, sans-serif`;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = fontSize / 15;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Add Top Text
      if (topText) {
        ctx.strokeText(topText.toUpperCase(), canvas.width / 2, fontSize);
        ctx.fillText(topText.toUpperCase(), canvas.width / 2, fontSize);
      }

      // Add Bottom Text
      if (bottomText) {
        ctx.strokeText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
        ctx.fillText(bottomText.toUpperCase(), canvas.width / 2, canvas.height - fontSize);
      }

      const link = document.createElement("a");
      link.download = "custom-meme.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
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
        </div>

        {image && (
          <button
            onClick={handleDownload}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20"
          >
            <Download size={20} />
            Download My Meme
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/40 p-4 min-h-[300px] overflow-hidden">
        {image ? (
          <div className="relative w-full max-w-md shadow-2xl rounded-xl overflow-hidden">
            <img src={image} alt="preview" className="w-full h-auto" />
            <h3 className="absolute top-2 sm:top-4 left-0 right-0 px-4 text-center font-black text-white uppercase text-lg sm:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] break-words pointer-events-none">
              {topText}
            </h3>
            <h3 className="absolute bottom-2 sm:bottom-4 left-0 right-0 px-4 text-center font-black text-white uppercase text-lg sm:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] break-words pointer-events-none">
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