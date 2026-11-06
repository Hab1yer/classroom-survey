// Run only against an explicitly marked synthetic survey on your own project.
// node --env-file=.env.local scripts/load-test.mjs SLUG --confirm-test-survey
import { writeFile } from "node:fs/promises";
const slug = process.argv[2];
if (!slug || !process.argv.includes("--confirm-test-survey"))
  throw new Error("Pass a test survey slug and --confirm-test-survey.");
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error("Load your public Supabase environment variables first.");
const headers = { apikey: key, "Content-Type": "application/json" };
async function rpc(name, body) {
  const started = performance.now();
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    ms: performance.now() - started,
  };
}
const { data: survey } = await rpc("get_public_survey", { p_slug: slug });
if (!survey?.title?.startsWith("[Load test]") || survey.status !== "active")
  throw new Error("Use an active survey with a title starting [Load test].");
const answers = survey.questions.map((q) => ({
  question_id: q.id,
  choice_id: q.choices[0].id,
}));
const started = performance.now();
const results = await Promise.all(
  Array.from({ length: 200 }, async () => {
    try {
      return await rpc("submit_survey_response", {
        p_survey_id: survey.id,
        p_anonymous_token: crypto.randomUUID(),
        p_answers: answers,
      });
    } catch (e) {
      return {
        status: 0,
        ms: performance.now() - started,
        data: { message: String(e) },
      };
    }
  }),
);
const durations = results.map((r) => r.ms).sort((a, b) => a - b);
const report = {
  date: new Date().toISOString(),
  survey_title: survey.title,
  requests: 200,
  concurrency: 200,
  successful: results.filter((r) => r.status === 200 && r.data.success).length,
  failed: results.filter((r) => r.status !== 200 || !r.data.success).length,
  elapsed_ms: Math.round(performance.now() - started),
  mean_ms: Math.round(durations.reduce((a, b) => a + b, 0) / 200),
  p95_ms: Math.round(durations[189]),
  max_ms: Math.round(durations[199]),
  errors: results
    .filter((r) => r.status !== 200)
    .map((r) => ({ status: r.status, message: r.data.message })),
};
console.log(JSON.stringify(report, null, 2));
await writeFile(
  "submission/evidence/load-test.json",
  JSON.stringify(report, null, 2) + "\n",
);
if (report.failed) process.exitCode = 1;
