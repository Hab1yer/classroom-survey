import { Link, NavLink, Outlet } from "react-router-dom";
import { BookOpen, LogOut, ArrowUpRight } from "lucide-react";
import { supabase } from "../lib/client";
import { useAuth } from "../lib/auth-context";
export function Layout() {
  const { user } = useAuth();
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" to="/dashboard">
          <BookOpen size={23} />
          <span>
            Classroom<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard">Surveys</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
        <div className="account">
          <span>{user?.email}</span>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main id="main" className="workspace">
        <Outlet />
      </main>
      <footer>
        CLASSROOM SURVEY{" "}
        <span>
          Made for the moments between questions.
          <ArrowUpRight size={13} />
        </span>
      </footer>
    </>
  );
}
