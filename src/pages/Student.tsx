import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Check, ArrowRight } from "lucide-react";
import { browserToken, message, rpc } from "../lib/api";
import type { Survey } from "../lib/types";
export default function Student() {
  const { slug } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setState("loading");
    setAnswers({});
    setError("");
    void rpc<Survey | null>("get_public_survey", { p_slug: slug })
      .then((s) => {
        if (!live) return;
        if (!s) setState("missing");
        else if (s.status !== "active") setState("closed");
        else {
          setSurvey(s);
          try {
            setState(
              localStorage.getItem(`classroom.submitted.${s.id}`)
                ? "duplicate"
                : "ready",
            );
          } catch {
            setState("ready");
          }
        }
      })
      .catch((e) => {
        if (live) {
          setError(message(e));
          setState("error");
        }
      });
    return () => {
      live = false;
    };
  }, [slug]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!survey) return;
    if (survey.questions.some((q) => !answers[q.id])) {
      setError("Please answer every question.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await rpc("submit_survey_response", {
        p_survey_id: survey.id,
        p_anonymous_token: browserToken(),
        p_answers: survey.questions.map((q) => ({
          question_id: q.id,
          choice_id: answers[q.id],
        })),
      });
      try {
        localStorage.setItem(`classroom.submitted.${survey.id}`, "true");
      } catch {
        /* Database uniqueness still protects this submission. */
      }
      setState("success");
    } catch (e) {
      const text = message(e);
      if (text.includes("already submitted")) setState("duplicate");
      else setError(text);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="student-shell">
      <div className="student-brand">
        <BookOpen size={20} />
        <span>Classroom.</span>
        <span className="small">STUDENT SURVEY</span>
      </div>
      {state === "loading" ? (
        <p className="loading" role="status">
          Loading survey…
        </p>
      ) : ["success", "duplicate", "closed", "missing", "error"].includes(
          state,
        ) ? (
        <section className="student-status" role="status">
          <div className="status-mark">
            {state === "success" ? <Check size={32} /> : <BookOpen size={30} />}
          </div>
          <h1>
            {
              {
                success: "Thank you!",
                duplicate: "Already submitted",
                closed: "This survey is closed.",
                missing: "Survey not found.",
                error: "Unable to load survey.",
              }[state]
            }
          </h1>
          <p>
            {
              {
                success:
                  "Your response has been recorded. You can close this page.",
                duplicate:
                  "You have already submitted a response to this survey.",
                closed: "This survey is no longer accepting responses.",
                missing: "Check the link with your instructor.",
                error,
              }[state]
            }
          </p>
          {state === "error" && (
            <button onClick={() => window.location.reload()}>Try again</button>
          )}
        </section>
      ) : (
        survey && (
          <>
            <div className="student-heading">
              <span className="badge active">
                <span className="live-dot" />
                Accepting responses
              </span>
              <h1>{survey.title}</h1>
              {survey.description && <p>{survey.description}</p>}
              <span className="small muted">
                {survey.questions.length} questions · Anonymous responses
              </span>
            </div>
            <form onSubmit={submit}>
              <fieldset className="student-fieldset" disabled={busy}>
                {survey.questions.map((q, i) => (
                  <fieldset className="student-question" key={q.id}>
                    <legend>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {q.question_text}
                    </legend>
                    {q.choices.map((c, j) => (
                      <label
                        key={c.id}
                        className={`answer-choice ${answers[q.id] === c.id ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={c.id}
                          required
                          checked={answers[q.id] === c.id}
                          onChange={() =>
                            setAnswers({ ...answers, [q.id]: c.id })
                          }
                        />
                        <span className="choice-letter">
                          {String.fromCharCode(65 + j)}
                        </span>
                        <span>{c.choice_text}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <button className="primary submit-response">
                  {busy ? "Submitting…" : "Submit response"}
                  <ArrowRight size={18} />
                </button>
              </fieldset>
            </form>
            <p className="student-foot">
              One response per browser. Your answers are visible only to the
              instructor.
            </p>
          </>
        )
      )}
    </main>
  );
}
