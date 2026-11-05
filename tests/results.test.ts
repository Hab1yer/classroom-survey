import { describe, it, expect } from "vitest";
import { aggregate, csvCell, exportCsv } from "../src/lib/results";
import type { Survey, Response } from "../src/lib/types";
const survey: Survey = {
  id: "s",
  title: 'Title, "quoted"',
  description: "Two\nlines",
  status: "closed",
  public_slug: "abc",
  created_at: "2026-11-05",
  updated_at: "2026-11-05",
  questions: [
    {
      id: "q",
      question_text: "Question?",
      question_type: "multiple_choice",
      position: 0,
      choices: [
        { id: "a", choice_text: "=1+1", position: 0 },
        { id: "b", choice_text: "Safe", position: 1 },
      ],
    },
  ],
};
const responses: Response[] = [
  {
    id: "r1",
    submitted_at: "2026-11-05T12:00:00Z",
    answers: [{ question_id: "q", choice_id: "a" }],
  },
  { id: "r2", submitted_at: "2026-11-05T12:01:00Z", answers: [] },
];
describe("Results and CSV", () => {
  it("uses answered counts and shows unanswered questions", () => {
    const result = aggregate(survey.questions[0], responses);
    expect(result.answered).toBe(1);
    expect(result.unanswered).toBe(1);
    expect(result.choices[0].percentage).toBe(100);
    expect(aggregate(survey.questions[0], []).choices[0].percentage).toBe(0);
  });
  it("escapes quotes, newlines and spreadsheet formulas", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(" =SUM(A1)")).toBe('"\' =SUM(A1)"');
    const csv = exportCsv(survey, responses);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Title, ""quoted"""');
    expect(csv).toContain('"Two\nlines"');
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain("Unanswered");
    expect(csv).toContain("survey_created_at");
  });
});
