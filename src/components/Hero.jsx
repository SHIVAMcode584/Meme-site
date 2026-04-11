import { motion as Motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-10">
      {/* Glow background */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-fuchsia-500/20 blur-3xl rounded-full"></div>
      <div className="absolute top-20 right-10 w-72 h-72 bg-cyan-500/20 blur-3xl rounded-full"></div>
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-500/20 blur-3xl rounded-full"></div>

      <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
        <Motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-5xl mx-auto"
        >
          Find the{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            perfect meme
          </span>{" "}
          for every situation.
        </Motion.h1>

        <Motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-zinc-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mt-6 leading-relaxed"
        >
          Search memes by mood, reaction, reply, awkward moment, roast, or
          real-life situations.
        </Motion.p>
      </div>
    </section>
  );
}
