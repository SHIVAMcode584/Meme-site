import { useState } from "react";
import { motion } from "framer-motion";
import { X, User, Mail, LogIn } from "lucide-react";

export default function LoginModal({ isOpen, onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !email) return;
    // Mock user data with a consistent avatar based on username
    const userData = { 
      username, 
      email, 
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}` 
    };
    onLogin(userData);
    onClose();
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
        className="relative w-full max-w-md bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Welcome Back 🚀</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white" />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 transition text-white" />
          </div>

          <button disabled={isLoading} type="submit" className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20 disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            {isLoading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}