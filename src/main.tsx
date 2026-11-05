import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, Protected } from "./components/Auth";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import Student from "./pages/Student";
import "./style.css";
const Results = lazy(() => import("./pages/Results"));
const Present = lazy(() => import("./pages/Present"));
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <p className="loading" role="status">
              Loading…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/s/:slug" element={<Student />} />
            <Route element={<Protected />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<Dashboard history />} />
                <Route path="/surveys/new" element={<Editor />} />
                <Route path="/surveys/:id/edit" element={<Editor />} />
                <Route path="/surveys/:id/results" element={<Results />} />
              </Route>
              <Route path="/surveys/:id/present" element={<Present />} />
            </Route>
            <Route
              path="*"
              element={
                <main className="narrow">
                  <h1>Page not found</h1>
                  <Link to="/dashboard">Return to surveys</Link>
                </main>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
