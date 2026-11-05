import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowUpRight,
  Copy,
  Archive,
  Trash2,
  Play,
  Square,
  ClipboardList,
} from "lucide-react";
import { duplicate, listSurveys, message, rpc } from "../lib/api";
import type { Survey } from "../lib/types";
export default function Dashboard({ history = false }: { history?: boolean }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState("");
  const navigate = useNavigate();
  async function load() {
    try {
      setSurveys(await listSurveys());
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(s: Survey, type: string) {
    if (
      ["delete", "archive", "close"].includes(type) &&
      !window.confirm(
        `${type === "delete" ? "Permanently delete" : type === "archive" ? "Archive" : "Close"} “${s.title}”? ${type === "delete" ? "The survey and all its responses will be permanently deleted." : type === "close" ? "Students will no longer be able to submit." : "Responses will be preserved."}`,
      )
    )
      return;
    setBusy(s.id);
    setError("");
    try {
      if (type === "duplicate") {
        navigate(`/surveys/${await duplicate(s)}/edit`);
        return;
      }
      if (
        type === "activate" &&
        surveys.some((x) => x.status === "active" && x.id !== s.id) &&
        !window.confirm(
          "Activating this survey will close the currently active survey. Continue?",
        )
      )
        return;
      await rpc(`${type}_survey`, { p_survey_id: s.id });
      await load();
      if (type === "activate") navigate(`/surveys/${s.id}/present`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  const visible = surveys.filter(
    (s) =>
      (!history || ["closed", "archived"].includes(s.status)) &&
      s.title.toLowerCase().includes(query.toLowerCase()) &&
      (status === "all" || s.status === status) &&
      (!date || s.created_at.slice(0, 10) >= date),
  );
  const active = surveys.find((s) => s.status === "active");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>
            {history ? "Survey history" : "Surveys"}
            <span className="heading-count">
              {history
                ? surveys.filter((s) =>
                    ["closed", "archived"].includes(s.status),
                  ).length
                : surveys.length}
            </span>
          </h1>
          <p className="muted">
            {history
              ? "Past questions. Lasting insights."
              : "Prepare a question. Make room for every answer."}
          </p>
        </div>
        <Link className="button primary" to="/surveys/new">
          <Plus size={18} />
          New survey
        </Link>
      </div>
      {!history && (
        <div className="overview">
          <div>
            <span className="small">TOTAL SURVEYS</span>
            <strong>{surveys.length.toString().padStart(2, "0")}</strong>
          </div>
          <div>
            <span className="small">READY TO LAUNCH</span>
            <strong>
              {surveys
                .filter((s) => s.status === "draft")
                .length.toString()
                .padStart(2, "0")}
            </strong>
          </div>
          <div className={active ? "active-overview" : ""}>
            <span className="small">IN THE CLASSROOM</span>
            {active ? (
              <Link to={`/surveys/${active.id}/present`}>
                <span className="live-dot" />
                {active.title}
                <ArrowUpRight size={18} />
              </Link>
            ) : (
              <strong className="no-active">No survey active</strong>
            )}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Search surveys"
            placeholder="Search surveys…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {(history
            ? ["closed", "archived"]
            : ["draft", "active", "closed", "archived"]
          ).map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        {history && (
          <label className="date-filter">
            Created from
            <input
              aria-label="Created from"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {loading ? (
        <p role="status" className="loading">
          Loading surveys…
        </p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <ClipboardList size={36} />
          <h2>
            {query || status !== "all" || date
              ? "No matching surveys"
              : history
                ? "No past surveys yet"
                : "Your next question starts here."}
          </h2>
          <p>
            {history
              ? "Closed and archived surveys will appear here."
              : query
                ? "Try another title or filter."
                : "Create a survey, then share it with your classroom."}
          </p>
          {!history && !query && (
            <Link className="button primary" to="/surveys/new">
              Create your first survey
              <Plus size={18} />
            </Link>
          )}
        </div>
      ) : (
        <div className="survey-list">
          {visible.map((s) => (
            <article
              className={`survey-row ${s.status === "active" ? "is-active" : ""}`}
              key={s.id}
            >
              <div className="survey-number">
                <ClipboardList size={21} />
              </div>
              <div className="survey-info">
                <div className="survey-title">
                  <Link to={`/surveys/${s.id}/results`}>{s.title}</Link>
                  <span className={`badge ${s.status}`}>
                    {s.status === "active" && <span className="live-dot" />}
                    {s.status}
                  </span>
                </div>
                <p>
                  {s.questions.length}{" "}
                  {s.questions.length === 1 ? "question" : "questions"}
                  <span>·</span>
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div
                className="row-actions"
                aria-label={`Actions for ${s.title}`}
              >
                <Link
                  className="button text-button"
                  to={`/surveys/${s.id}/results`}
                >
                  Results
                  <ArrowUpRight size={15} />
                </Link>
                {s.status === "active" ? (
                  <>
                    <Link className="button" to={`/surveys/${s.id}/present`}>
                      Present QR
                    </Link>
                    <button
                      disabled={busy === s.id}
                      onClick={() => void action(s, "close")}
                    >
                      <Square size={14} />
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    {s.status !== "archived" && (
                      <>
                        <Link className="button" to={`/surveys/${s.id}/edit`}>
                          Edit
                        </Link>
                        <button
                          className="launch"
                          disabled={busy === s.id}
                          onClick={() => void action(s, "activate")}
                        >
                          <Play size={14} />
                          Activate
                        </button>
                      </>
                    )}
                  </>
                )}
                <details className="more">
                  <summary aria-label={`More actions for ${s.title}`}>
                    •••
                  </summary>
                  <div>
                    <button
                      disabled={busy === s.id}
                      onClick={() => void action(s, "duplicate")}
                    >
                      <Copy size={15} />
                      Duplicate
                    </button>
                    {s.status !== "archived" && (
                      <button
                        disabled={busy === s.id}
                        onClick={() => void action(s, "archive")}
                      >
                        <Archive size={15} />
                        Archive
                      </button>
                    )}
                    <button
                      className="danger"
                      disabled={busy === s.id}
                      onClick={() => void action(s, "delete")}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="list-foot">
        {visible.length} {visible.length === 1 ? "survey" : "surveys"}
        <span>Responses stay private to your instructor workspace.</span>
      </p>
    </>
  );
}
