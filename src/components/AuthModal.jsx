import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const getSiteUrl = () => {
    return import.meta.env.VITE_SITE_URL || window.location.origin;
  };

  // 🔐 Signup
  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Signup successful!");
  };

  // 🔐 Login
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
    else {
      alert("Login successful!");
      onClose();
    }
  };

  // 🔐 Forgot password
  const handleForgot = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/reset-password`,
    });

    if (error) alert(error.message);
    else alert("Password reset email sent!");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111827] p-6 rounded-xl w-[350px] text-white">
        <h2 className="text-xl font-bold mb-4 text-center">
          {mode === "login" && "Login"}
          {mode === "signup" && "Signup"}
          {mode === "forgot" && "Reset Password"}
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 rounded bg-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {mode !== "forgot" && (
          <input
            type="password"
            placeholder="Password"
            className="w-full mb-3 p-2 rounded bg-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {/* Buttons */}
        {mode === "login" && (
          <>
            <button onClick={handleLogin} className="btn">
              Login
            </button>
            <p onClick={() => setMode("forgot")} className="link">
              Forgot Password?
            </p>
            <p onClick={() => setMode("signup")} className="link">
              Create Account
            </p>
          </>
        )}

        {mode === "signup" && (
          <>
            <button onClick={handleSignup} className="btn">
              Signup
            </button>
            <p onClick={() => setMode("login")} className="link">
              Already have account?
            </p>
          </>
        )}

        {mode === "forgot" && (
          <>
            <button onClick={handleForgot} className="btn">
              Send Reset Link
            </button>
            <p onClick={() => setMode("login")} className="link">
              Back to Login
            </p>
          </>
        )}

        <button onClick={onClose} className="mt-4 text-red-400 text-sm">
          Close
        </button>
      </div>

      {/* styles */}
      <style>{`
        .btn {
          width: 100%;
          padding: 10px;
          background: #7c3aed;
          border-radius: 8px;
          margin-top: 5px;
        }
        .link {
          font-size: 12px;
          color: #a78bfa;
          margin-top: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}