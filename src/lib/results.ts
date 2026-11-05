import type { Survey, Response, Question } from "./types";
export function aggregate(q: Question, responses: Response[]) {
  const answered = responses.filter((r) =>
    r.answers.some((a) => a.question_id === q.id),
  ).length;
  return {
    answered,
    unanswered: responses.length - answered,
    choices: q.choices.map((c) => {
      const count = responses.filter((r) =>
        r.answers.some((a) => a.question_id === q.id && a.choice_id === c.id),
      ).length;
      return {
        ...c,
        count,
        percentage: answered ? (count / answered) * 100 : 0,
      };
    }),
  };
}
export function csvCell(value: string) {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportCsv(s: Survey, responses: Response[]) {
  const rows = [
    [
      "survey_id",
      "survey_title",
      "survey_description",
      "survey_status",
      "survey_created_at",
      "response_id",
      "submitted_at",
      ...s.questions.map((q) => q.question_text),
    ],
    ...responses.map((r) => [
      s.id,
      s.title,
      s.description,
      s.status,
      s.created_at,
      r.id,
      r.submitted_at,
      ...s.questions.map(
        (q) =>
          q.choices.find(
            (c) =>
              c.id === r.answers.find((a) => a.question_id === q.id)?.choice_id,
          )?.choice_text || "Unanswered",
      ),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function download(
  content: Blob | string,
  name: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
