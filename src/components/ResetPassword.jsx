import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import Footer from "./Footer";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password) return;
    
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: "Password updated successfully! You can now sign in." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col">
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-violet-500/10 text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Set New Password</h2>
            <p className="text-zinc-500 mt-2">Enter your new secure password below</p>
          </div>

          {message.text ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-4 rounded-2xl border mb-6 text-center ${
                message.type === "success"
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {message.type === "success" && <CheckCircle2 className="mx-auto mb-2" size={24} />}
              <p className="text-sm font-medium">{message.text}</p>
              {message.type === "success" && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="mt-4 text-xs font-bold uppercase tracking-widest text-white bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition"
                >
                  Back to Home
                </button>
              )}
            </motion.div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  placeholder="New Password"
                  required
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition text-white"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button 
                disabled={isLoading || !password}
                type="submit" 
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <a href="/" className="text-zinc-500 hover:text-white transition text-sm flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back to RoastRiot.meme
            </a>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
