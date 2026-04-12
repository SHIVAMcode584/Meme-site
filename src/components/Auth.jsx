import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Signup successful! Check your email.");
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Login successful!");
    }
  };

  return (
    <div className="p-4 border border-white/10 rounded-xl">
      <h2 className="text-xl font-bold mb-3">Login / Signup</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="block mb-2 p-2 w-full bg-black text-white"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="block mb-3 p-2 w-full bg-black text-white"
      />

      <div className="flex gap-2">
        <button onClick={handleSignup} className="px-4 py-2 bg-green-500 rounded">
          Signup
        </button>

        <button onClick={handleLogin} className="px-4 py-2 bg-blue-500 rounded">
          Login
        </button>
      </div>
    </div>
  );
}