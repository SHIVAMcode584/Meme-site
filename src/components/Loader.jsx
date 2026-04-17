import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Loader() {
  return (
    <motion.div
      key="app-loader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f0f] px-6 text-white"
    >
      <div className="absolute inset-0">
        <motion.div
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.3, 0.55, 0.3],
          }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/12 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.05, 0.95, 1.05],
            opacity: [0.18, 0.3, 0.18],
          }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_36%),linear-gradient(180deg,rgba(10,10,10,0.2),rgba(10,10,10,0.86))]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 text-center"
      >
        <motion.div
          animate={{
            scale: [1, 1.03, 1],
            textShadow: [
              "0 0 18px rgba(244,114,182,0.25), 0 0 48px rgba(168,85,247,0.12)",
              "0 0 30px rgba(244,114,182,0.42), 0 0 72px rgba(34,211,238,0.18)",
              "0 0 18px rgba(244,114,182,0.25), 0 0 48px rgba(168,85,247,0.12)",
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-gradient-to-r from-fuchsia-300 via-white to-cyan-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
        >
          RoastRiot
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="mt-4 text-sm tracking-[0.24em] text-zinc-400 uppercase"
        >
          Loading memes...
        </motion.p>

        <div className="mt-6 flex justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="rounded-full border border-white/10 bg-white/5 p-3"
          >
            <Loader2 className="h-5 w-5 text-fuchsia-200" />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
