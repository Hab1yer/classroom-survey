import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  allowed: boolean;
}>({ user: null, loading: true, allowed: false });
export const useAuth = () => useContext(AuthContext);
