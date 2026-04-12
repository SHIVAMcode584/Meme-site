import { useState } from "react";
import { motion } from "framer-motion";
import { X, User, Mail, LogIn, Loader2, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function LoginModal({ isOpen, onClose, onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError("");
    
    try {
      let data, authError;

      if (isSignUp) {
        const res = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { username: username.trim(), avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}` }
          }
        });
        data = res.data;
        authError = res.error;
        if (!authError && !data.session) {
          setError("Signup successful! Please check your email for a confirmation link.");
          setIsLoading(false);
          return;
        }
      } else {
        const res = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        data = res.data;
        authError = res.error;
        
        if (authError?.message?.includes("Invalid login credentials")) {
          throw new Error("Wrong email/password or account doesn't exist. Try signing up!");
        }
      }

      if (authError) throw authError;

      const user = data.user;
      onLogin({ 
        username: user.user_metadata?.username || email.split('@')[0], 
        email: user.email, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}` 
      });
      onClose();
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Network error: Check your API Key and URL" : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h2 className="text-2xl font-bold">{isSignUp ? "Create Account ✨" : "Welcome Back 🚀"}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white" />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20">
              {error}
            </p>
          )}

          <button disabled={isLoading} type="submit" className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20 disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            {isLoading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-zinc-400 hover:text-violet-400 text-sm transition"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}