import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Play,
} from "lucide-react";
import { getSurvey, getResponses, message, rpc, saveSurvey } from "../lib/api";
import type { DraftQuestion, Status } from "../lib/types";
const newQuestion = (): DraftQuestion => ({
  key: crypto.randomUUID(),
  question_text: "",
  question_type: "multiple_choice",
  choices: ["", ""],
});
export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState("");
  const [dirty, setDirty] = useState(false);
  const savedId = useRef<string | null>(id || null);
  const [status, setStatus] = useState<Status>("draft");
  useEffect(() => {
    let live = true;
    savedId.current = id || null;
    setLocked("");
    if (!id) {
      setTitle("");
      setDescription("");
      setQuestions([newQuestion()]);
      setStatus("draft");
      setDirty(false);
      setLoading(false);
    } else setLoading(true);
    if (id)
      void Promise.all([getSurvey(id), getResponses(id)])
        .then(([s, r]) => {
          if (!live) return;
          setTitle(s.title);
          setDescription(s.description);
          setStatus(s.status);
          setQuestions(
            s.questions.map((q) => ({
              ...q,
              key: q.id,
              choices: q.choices.map((c) => c.choice_text),
            })),
          );
          if (s.status === "active")
            setLocked("Close this survey from the dashboard before editing.");
          else if (r.length)
            setLocked(
              "This survey has responses. Duplicate it from the dashboard to make changes while preserving the results.",
            );
        })
        .catch((e) => {
          if (live) setError(message(e));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(index: number, patch: Partial<DraftQuestion>) {
    setDirty(true);
    setQuestions((q) =>
      q.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    );
  }
  function move<T>(items: T[], i: number, delta: number) {
    const copy = [...items];
    [copy[i], copy[i + delta]] = [copy[i + delta], copy[i]];
    return copy;
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const activate =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "activate";
    try {
      // Retain the committed ID when the separate activation request fails.
      const sid = await saveSurvey(
        savedId.current,
        title.trim(),
        description.trim(),
        questions,
      );
      savedId.current = sid;
      setStatus("draft");
      setDirty(false);
      if (activate) {
        try {
          await rpc("activate_survey", { p_survey_id: sid });
        } catch (activationError) {
          // A refresh must also reopen the saved draft, not an empty new form.
          navigate(`/surveys/${sid}/edit`, { replace: true });
          throw new Error(
            `Your survey was saved, but activation could not be confirmed. ${message(activationError)}`,
          );
        }
        navigate(`/surveys/${sid}/present`);
      } else navigate("/dashboard");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading survey…</p>;
  return (
    <>
      <Link
        className="back-link"
        to="/dashboard"
        onClick={(e) => {
          if (dirty && !confirm("Leave without saving your changes?"))
            e.preventDefault();
        }}
      >
        <ArrowLeft size={16} />
        Surveys
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SURVEY BUILDER</p>
          <h1>{id ? "Edit survey" : "A new question."}</h1>
        </div>
        <span className={`badge ${status}`}>{status}</span>
      </div>
      {locked ? (
        <div className="notice">{locked}</div>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={busy} className="editor-fields">
            <section className="panel survey-details">
              <h2>Survey details</h2>
              <label>
                Title
                <input
                  required
                  maxLength={200}
                  value={title}
                  placeholder="e.g. Recursion concept check"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  pattern=".*\S.*"
                />
              </label>
              <label>
                Description <span className="muted small">(optional)</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={description}
                  placeholder="A little context for your students"
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            </section>
            <div className="section-heading">
              <h2>Questions</h2>
              <span className="muted small">
                All questions require an answer
              </span>
            </div>
            {questions.map((q, i) => (
              <section className="panel question-editor" key={q.key}>
                <div className="question-top">
                  <span className="eyebrow">
                    QUESTION {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="compact-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move question ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => {
                        setQuestions(move(questions, i, -1));
                        setDirty(true);
                      }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move question ${i + 1} down`}
                      disabled={i === questions.length - 1}
                      onClick={() => {
                        setQuestions(move(questions, i, 1));
                        setDirty(true);
                      }}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Delete question ${i + 1}`}
                      disabled={questions.length === 1}
                      onClick={() => {
                        if (confirm(`Delete question ${i + 1}?`)) {
                          setQuestions(questions.filter((_, j) => i !== j));
                          setDirty(true);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <label>
                  Question
                  <input
                    required
                    maxLength={1000}
                    pattern=".*\S.*"
                    value={q.question_text}
                    onChange={(e) =>
                      update(i, { question_text: e.target.value })
                    }
                    placeholder="What would you like to ask?"
                  />
                </label>
                <label className="type-select">
                  Answer type
                  <select
                    value={q.question_type}
                    onChange={(e) => {
                      const type = e.target
                        .value as DraftQuestion["question_type"];
                      update(i, {
                        question_type: type,
                        choices:
                          type === "true_false" ? ["True", "False"] : ["", ""],
                      });
                    }}
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="true_false">True / False</option>
                  </select>
                </label>
                <div className="choice-editor">
                  {q.choices.map((choice, j) => (
                    <div className="choice-line" key={j}>
                      <span className="choice-letter">
                        {String.fromCharCode(65 + j)}
                      </span>
                      <input
                        aria-label={`Question ${i + 1} choice ${j + 1}`}
                        required
                        maxLength={500}
                        pattern=".*\S.*"
                        value={choice}
                        readOnly={q.question_type === "true_false"}
                        onChange={(e) =>
                          update(i, {
                            choices: q.choices.map((c, k) =>
                              j === k ? e.target.value : c,
                            ),
                          })
                        }
                      />
                      {q.question_type === "multiple_choice" && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Move choice ${j + 1} up in question ${i + 1}`}
                            disabled={j === 0}
                            onClick={() =>
                              update(i, { choices: move(q.choices, j, -1) })
                            }
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Move choice ${j + 1} down in question ${i + 1}`}
                            disabled={j === q.choices.length - 1}
                            onClick={() =>
                              update(i, { choices: move(q.choices, j, 1) })
                            }
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            aria-label={`Delete choice ${j + 1} from question ${i + 1}`}
                            disabled={q.choices.length <= 2}
                            onClick={() => {
                              if (confirm("Delete this answer choice?"))
                                update(i, {
                                  choices: q.choices.filter((_, k) => k !== j),
                                });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {q.question_type === "multiple_choice" && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={q.choices.length >= 10}
                    onClick={() => update(i, { choices: [...q.choices, ""] })}
                  >
                    <Plus size={16} />
                    Add choice
                  </button>
                )}
              </section>
            ))}
            <button
              type="button"
              className="add-question"
              disabled={questions.length >= 50}
              onClick={() => {
                setQuestions([...questions, newQuestion()]);
                setDirty(true);
              }}
            >
              <Plus size={18} />
              Add question
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="editor-save">
              <span className="muted small">
                {busy
                  ? "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : "Ready when you are"}
              </span>
              <button type="submit" value="draft">
                <Save size={16} />
                Save draft
              </button>
              <button type="submit" value="activate" className="primary">
                <Play size={16} />
                Save & activate
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </>
  );
}
