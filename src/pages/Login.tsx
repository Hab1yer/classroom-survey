import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { supabase, configured } from "../lib/client";
import { message } from "../lib/api";
export default function Login() {
  const { user, loading } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (user && !loading) return <Navigate to="/dashboard" replace />;
  return (
    <main className="login-layout">
      <section className="login-aside">
        <div className="brand">
          <BookOpen />
          <span>Classroom.</span>
        </div>
        <div>
          <p className="eyebrow">A clearer picture of your classroom</p>
          <h1>
            Ask a question.
            <br />
            See what clicks.
          </h1>
          <p>
            Quick classroom surveys. Anonymous answers.
            <br />A little more understanding, every class.
          </p>
        </div>
        <span className="small">CSE 4095 · CLASSROOM SURVEY</span>
      </section>
      <section className="login-form">
        <p className="eyebrow">INSTRUCTOR WORKSPACE</p>
        <h2>Welcome back.</h2>
        <p className="muted">Sign in to prepare your next question.</p>
        {!configured && (
          <div className="notice" role="alert">
            Supabase is not configured. Add the project URL and public key to
            your environment, then rebuild.
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !configured}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="small muted">
          Joining as a student? Open the survey link or scan your instructor’s
          QR code. No account needed.
        </p>
      </section>
    </main>
  );
}
