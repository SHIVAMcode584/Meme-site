import { useState } from "react";
import { motion } from "framer-motion";
import { X, User, Mail, LogIn, Loader2, Lock, ArrowLeft, Wand2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import AvatarPicker from "./AvatarPicker";
import { DEFAULT_AVATAR_ID, getAvatarUrlById } from "../utils/avatarOptions";

export default function LoginModal({ isOpen, onClose }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getSiteUrl = () => {
    return import.meta.env.VITE_SITE_URL || window.location.origin;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    
    try {
      if (mode === "signup") {
        const trimmedUsername = username.trim();

        if (!trimmedUsername) {
          throw new Error("Please choose a username before continuing.");
        }

        const { error: authError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            data: { 
              username: trimmedUsername,
              avatar_choice: selectedAvatarId,
              avatar_url: getAvatarUrlById(selectedAvatarId),
            },
            emailRedirectTo: getSiteUrl(),
          }
        });

        if (authError) throw authError;
        setMessage({ type: "success", text: "Magic link sent! Please check your email to verify and create your account. 📧" });
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        
        if (authError) {
          if (authError.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password. Please try again.");
          }
          throw authError;
        }
        onClose();
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${getSiteUrl()}/reset-password`,
        });
        if (authError) throw authError;
        setMessage({ type: "success", text: "Password reset link sent to your email!" });
      }
    } catch (err) {
      setMessage({ 
        type: "error", 
        text: err.message === "Failed to fetch" ? "Network error: Check your connection" : err.message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getSiteUrl()
        }
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Magic link sent! Check your email 📧" });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 lg:pl-64">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-[#0d1220] border border-white/10 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === "login" && "Welcome Back 🚀"}
              {mode === "signup" && "Create Account ✨"}
              {mode === "forgot" && "Reset Password 🔑"}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {mode === "login" && "Sign in to your account to continue"}
              {mode === "signup" && "Join the community of meme creators"}
              {mode === "forgot" && "Enter your email to receive a reset link"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition text-white" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={getAvatarUrlById(selectedAvatarId)}
                    alt="Selected avatar"
                    className="h-14 w-14 rounded-full border border-violet-400/40 bg-[#0d1220] object-cover"
                  />
                  <div>
                    <p className="font-semibold text-white">Choose your avatar</p>
                    <p className="text-xs text-zinc-500">You can change this later from your profile page.</p>
                  </div>
                </div>

                <AvatarPicker
                  selectedAvatarId={selectedAvatarId}
                  onSelect={setSelectedAvatarId}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition text-white" />
          </div>
          {mode === "login" && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-12 pr-12 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {mode === "login" && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setMode("forgot")} className="text-xs text-violet-400 hover:text-violet-300 transition">
                Forgot Password?
              </button>
            </div>
          )}

          {message.text && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-sm p-4 rounded-2xl border flex flex-col gap-2 ${
                message.type === "error" 
                  ? "text-red-400 bg-red-400/10 border-red-400/20" 
                  : "text-green-400 bg-green-400/10 border-green-400/20"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {message.type === "success" ? <CheckCircle2 size={18} /> : <X size={18} />}
                {message.type === "success" ? "Success!" : "Oops!"}
              </div>
              <p>{message.text}</p>
            </motion.div>
          )}

          <button disabled={isLoading} type="submit" className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition shadow-lg shadow-violet-500/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            {isLoading ? "Processing..." : (mode === "signup" ? "Send Magic Link" : mode === "login" ? "Sign In" : "Send Reset Link")}
          </button>

          {mode === "login" && (
            <button 
              type="button"
              onClick={handleMagicLink}
              disabled={isLoading || !email}
              className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 text-zinc-300 font-bold flex items-center justify-center gap-2 hover:bg-white/10 hover:border-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} className="text-violet-400" />}
              Login with Magic Link
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          {mode === "forgot" ? (
            <button onClick={() => setMode("login")} className="text-zinc-400 hover:text-violet-400 text-sm transition flex items-center justify-center gap-2 mx-auto">
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          ) : (
            <button 
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage({ type: "", text: "" });
              }} 
              className="text-zinc-400 hover:text-violet-400 text-sm transition"
            >
              {mode === "login" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
