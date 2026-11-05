import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw, QrCode } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getResponses, getSurvey, message } from "../lib/api";
import { aggregate, download, exportCsv } from "../lib/results";
import type { Survey, Response } from "../lib/types";
export default function Results() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getSurvey(id!), getResponses(id!)]);
      setSurvey(s);
      setResponses(r);
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <Link className="back-link" to="/dashboard">
        <ArrowLeft size={16} />
        Surveys
      </Link>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!survey ? (
        loading ? (
          <p role="status">Loading results…</p>
        ) : (
          <button onClick={() => void load()}>Retry</button>
        )
      ) : (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">SURVEY RESULTS</p>
              <h1>{survey.title}</h1>
              <p className="muted">{survey.description}</p>
            </div>
            <span className={`badge ${survey.status}`}>{survey.status}</span>
          </div>
          <div className="results-summary">
            <div>
              <strong>{responses.length}</strong>
              <span>total responses</span>
            </div>
            <div>
              <strong>{survey.questions.length}</strong>
              <span>questions</span>
            </div>
            <div className="results-actions">
              <button disabled={loading} onClick={() => void load()}>
                <RefreshCw size={16} />
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={() =>
                  download(
                    exportCsv(survey, responses),
                    `survey-${survey.public_slug}.csv`,
                  )
                }
              >
                <Download size={16} />
                Export CSV
              </button>
              {survey.status === "active" && (
                <Link className="button primary" to={`/surveys/${id}/present`}>
                  <QrCode size={16} />
                  Present QR
                </Link>
              )}
            </div>
          </div>
          <p className="small muted" role="status">
            {updated && `Updated ${updated.toLocaleTimeString()}`}
          </p>
          {responses.length === 0 && (
            <div className="notice">
              No responses yet. Activate the survey and display its QR code so
              students can join.
            </div>
          )}
          <div className="result-questions">
            {survey.questions.map((q, i) => {
              const result = aggregate(q, responses);
              return (
                <section className="panel" key={q.id}>
                  <div className="question-top">
                    <span className="eyebrow">
                      QUESTION {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="small muted">
                      {result.answered} answered · {result.unanswered}{" "}
                      unanswered
                    </span>
                  </div>
                  <h2>{q.question_text}</h2>
                  <div className="chart" aria-hidden="true">
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(150, q.choices.length * 48)}
                    >
                      <BarChart
                        data={result.choices.map((c, j) => ({
                          name: String.fromCharCode(65 + j),
                          count: c.count,
                        }))}
                        layout="vertical"
                        margin={{ left: 0, right: 24 }}
                      >
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={25} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          fill="#27634e"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={24}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="results-table">
                    <caption className="sr-only">
                      Answer counts and percentages for {q.question_text}
                    </caption>
                    <thead>
                      <tr>
                        <th>Answer</th>
                        <th>Responses</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.choices.map((c, j) => (
                        <tr key={c.id}>
                          <td>
                            <span className="choice-letter">
                              {String.fromCharCode(65 + j)}
                            </span>
                            {c.choice_text}
                          </td>
                          <td>{c.count}</td>
                          <td>{c.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="small muted">
                    Percentages use the number of responses to this question.
                  </p>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
