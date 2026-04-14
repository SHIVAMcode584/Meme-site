import { motion, AnimatePresence } from "framer-motion";
import { X, LogIn, Upload, Edit3, Heart, Wand2, Trophy, HelpCircle, Share2, Zap, Sparkles, Award, Search, MessageCircle, ArrowRight } from "lucide-react";

const GuideSection = ({ icon: Icon, title, description, steps, action }) => (
  <div className="space-y-4 group p-5 sm:p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.08] transition-all duration-300">
    <div className="flex items-center gap-4">
      <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500 group-hover:text-white group-hover:rotate-3 transition-all duration-300">
        <Icon size={20} />
      </div>
      <h3 className="font-bold text-lg text-white group-hover:text-violet-300 transition-colors">{title}</h3>
    </div>
    <p className="text-zinc-400 text-sm leading-relaxed pl-1">{description}</p>
    <ul className="grid gap-2.5 pl-1">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-zinc-500">
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/40 shrink-0" />
          <span className="group-hover:text-zinc-300 transition-colors">{step}</span>
        </li>
      ))}
    </ul>
    {action && (
      <button 
        onClick={action.onClick}
        className="mt-4 flex items-center gap-2 text-sm font-bold text-violet-400 hover:text-violet-300 transition-colors group/btn"
      >
        {action.label} <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
      </button>
    )}
  </div>
);

export default function HelpModal({ isOpen, onClose, user, onLoginClick }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-64">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0d1220] border border-white/10 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-y-auto max-h-[85vh] custom-scrollbar scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent hover:scrollbar-thumb-violet-500/40 transition-all"
      > 
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
              <HelpCircle size={28} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">How to use RoastRiot</h2>
              <p className="text-zinc-500 text-sm mt-1">Master the art of situational memeing</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-12">
          <GuideSection 
            icon={Zap}
            title="Quick Start: Magic Links"
            description="No passwords required! Jump straight into the action."
            steps={[
              "Sign up/Login instantly with Magic Links sent to your email.",
              "Build your identity with a unique username and auto-generated avatar.",
              "Access your profile from the sidebar to manage your account.",
              "Stay logged in to save your favorite memes across devices."
            ]}
            action={!user ? { label: "Create Account Now", onClick: onLoginClick } : null}
          />

          <GuideSection 
            icon={Edit3}
            title="The Meme Editor"
            description="Create custom situational memes using our built-in canvas tool."
            steps={[
              "Choose a base image from your library or existing templates.",
              "Add 'Top Text' and 'Bottom Text' to describe the situation.",
              "Switch colors (Yellow, Green, Red, etc.) to match the vibe.",
              "Download directly or publish to the RoastRiot Hub."
            ]}
          />

          <GuideSection 
            icon={Upload}
            title="Contributing to the Hub"
            description="Upload your gems and help others find the perfect roast."
            steps={[
              "Set Categories like 'Reply' or 'Funny' for quick discovery.",
              "Select a Mood (Happy, Awkward, Angry) to contextualize.",
              "Pro Tip: Add comma-separated keywords for situational search.",
              "Earn +10 points for every successful upload! 🏆"
            ]}
            action={!user ? { label: "Login to Contribute", onClick: onLoginClick } : null}
          />

          <GuideSection 
            icon={Search}
            title="Finding the Perfect Meme"
            description="Our smart search understands situational context."
            steps={[
              "Search by mood (Awkward, Happy) or situation ('kyu nhi ho rhi padhai').",
              "Click on any meme to view details, download, or save.",
              "Use categories like 'Reply' or 'Reaction' to narrow down results.",
              "Try 'Next Random Meme' when you're looking for inspiration."
            ]}
          />

          <GuideSection 
            icon={Award}
            title="Reputation & Badges"
            description="Climb the leaderboard by contributing to the community."
            steps={[
              "Earn +10 points for every meme you upload to the hub.",
              "Newcomer (0+): Welcome to the family!",
              "Rookie (100+): You're starting to get the vibe.",
              "Meme Pro (500+): A recognized master of situational roasts.",
              "Legend (1000+): Your name is etched in the Hall of Fame! 🏆"
            ]}
          />

          <GuideSection 
            icon={Share2}
            title="Sharing & Community"
            description="Humor is better when shared. Connect with others instantly."
            steps={[
              "Save memes to your personal 'Favorites' list for quick access.",
              "Share directly to WhatsApp or copy short-links for chat.",
              "Every meme has a unique URL—send the link to take friends to that exact meme.",
              "Check the Leaderboard to see who's ruling the Riot today."
            ]}
          />
        </div>

        <button
          onClick={!user ? onLoginClick : onClose}
          className="w-full mt-12 h-16 rounded-[1.5rem] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-lg shadow-xl shadow-violet-500/20 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          {!user ? (
            <span className="flex items-center justify-center gap-2">
              <LogIn size={20} /> Sign In & Join the Riot
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={20} /> Let's Start Creating!
            </span>
          )}
        </button>
      </motion.div>
    </div>
  );
}