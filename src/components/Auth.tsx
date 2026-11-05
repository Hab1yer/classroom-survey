import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, Outlet } from "react-router-dom";
import { supabase, configured } from "../lib/client";
import { AuthContext, useAuth } from "../lib/auth-context";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    user: null as User | null,
    loading: true,
    allowed: false,
  });
  useEffect(() => {
    let live = true;
    let generation = 0;
    async function update(user: User | null) {
      const version = ++generation;
      if (!user) {
        if (live) setState({ user: null, loading: false, allowed: false });
        return;
      }
      const { data, error } = await supabase.rpc("is_instructor");
      if (live && version === generation)
        setState({ user, loading: false, allowed: !error && data === true });
    }
    if (!configured) {
      setState({ user: null, loading: false, allowed: false });
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => update(data.session?.user || null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void update(session?.user || null));
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function Protected() {
  const { user, loading, allowed } = useAuth();
  if (loading)
    return (
      <p className="loading" role="status">
        Loading workspace…
      </p>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed)
    return (
      <main className="narrow">
        <h1>Instructor access required</h1>
        <p>
          Your account is signed in, but has not been added to this classroom’s
          instructor list.
        </p>
        <button onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </main>
    );
  return <Outlet />;
}
