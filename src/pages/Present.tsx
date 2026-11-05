import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Download, Square, ExternalLink } from "lucide-react";
import { getSurvey, message, rpc } from "../lib/api";
import { supabase } from "../lib/client";
import type { Survey } from "../lib/types";
export default function Present() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [count, setCount] = useState(0);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = survey ? `${window.location.origin}/s/${survey.public_slug}` : "";
  useEffect(() => {
    let live = true;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const [s, r] = await Promise.all([
          getSurvey(id!),
          supabase
            .from("responses")
            .select("id", { count: "exact", head: true })
            .eq("survey_id", id!),
        ]);
        if (r.error) throw r.error;
        if (live) {
          setSurvey(s);
          setCount(r.count || 0);
          setError("");
        }
      } catch (e) {
        if (live) setError(message(e));
      } finally {
        fetching = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);
  useEffect(() => {
    let live = true;
    if (url)
      void QRCode.toDataURL(url, {
        width: 900,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#102d25", light: "#ffffff" },
      })
        .then((data) => {
          if (live) setQr(data);
        })
        .catch((e) => {
          if (live) setError(message(e));
        });
    return () => {
      live = false;
    };
  }, [url]);
  async function close() {
    if (
      !confirm("Close this survey? Students will no longer be able to submit.")
    )
      return;
    setBusy(true);
    try {
      await rpc("close_survey", { p_survey_id: id });
      navigate(`/surveys/${id}/results`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="presentation">
      <Link className="back-link" to="/dashboard">
        <ArrowLeft size={16} />
        Back to surveys
      </Link>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {survey ? (
        <>
          <span className={`badge ${survey.status}`}>
            {survey.status === "active" ? (
              <>
                <span className="live-dot" />
                Join the survey
              </>
            ) : (
              "Survey closed"
            )}
          </span>
          <h1>{survey.title}</h1>
          {survey.status === "active" ? (
            <>
              <p>Scan to answer. No login needed.</p>
              {qr && (
                <img
                  className="qr"
                  src={qr}
                  alt={`QR code for ${url}`}
                  width={400}
                  height={400}
                />
              )}
              <a
                className="public-url"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {url.replace(/^https?:\/\//, "")}
                <ExternalLink size={18} />
              </a>
            </>
          ) : (
            <p>This survey is no longer accepting responses.</p>
          )}
          <div className="response-counter" aria-live="polite">
            <strong>{count}</strong>
            <span>responses received</span>
          </div>
          <div className="presentation-actions">
            {qr && survey.status === "active" && (
              <a
                className="button"
                href={qr}
                download={`survey-${survey.public_slug}-qr.png`}
              >
                <Download size={16} />
                Download QR
              </a>
            )}
            <Link className="button" to={`/surveys/${id}/results`}>
              View results
            </Link>
            {survey.status === "active" && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void close()}
              >
                <Square size={15} />
                Close survey
              </button>
            )}
          </div>
        </>
      ) : (
        <p role="status">Loading presentation…</p>
      )}
    </main>
  );
}
