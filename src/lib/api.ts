import { supabase } from "./client";
import type { DraftQuestion, Survey, Response } from "./types";
export function message(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message || error);
  const messages: Record<string, string> = {
    SURVEY_NOT_ACTIVE: "This survey is no longer accepting responses.",
    DUPLICATE_RESPONSE: "You have already submitted a response to this survey.",
    INVALID_QUESTION: "The questions have changed. Refresh and try again.",
    INVALID_CHOICE: "An answer is no longer available. Refresh and try again.",
    MISSING_REQUIRED_ANSWER: "Please answer every question.",
    UNAUTHORIZED: "Your account does not have instructor access.",
    SURVEY_ACTIVE: "Close this survey before editing.",
    HAS_RESPONSES:
      "Duplicate this survey to edit it while preserving its responses.",
  };
  return (
    Object.entries(messages).find(([code]) => raw.includes(code))?.[1] || raw
  );
}
export async function rpc<T = undefined>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(message(error));
  return data as T;
}
export async function listSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase
    .from("surveys")
    .select("*,questions(*,choices(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(sortSurvey);
}
function sortSurvey(s: Survey): Survey {
  return {
    ...s,
    questions: [...s.questions]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        ...q,
        choices: [...q.choices].sort((a, b) => a.position - b.position),
      })),
  };
}
export async function getSurvey(id: string): Promise<Survey> {
  const { data, error } = await supabase
    .from("surveys")
    .select("*,questions(*,choices(*))")
    .eq("id", id)
    .single();
  if (error) throw error;
  return sortSurvey(data);
}
export async function getResponses(id: string): Promise<Response[]> {
  const rows: Response[] = [];
  // Explicit pagination prevents Supabase's default 1,000-row limit from truncating exports.
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase
      .from("responses")
      .select("id,submitted_at,answers(question_id,choice_id)")
      .eq("survey_id", id)
      .order("submitted_at")
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}
export const saveSurvey = (
  id: string | null,
  title: string,
  description: string,
  questions: DraftQuestion[],
) =>
  rpc<string>("save_survey", {
    p_survey_id: id,
    p_title: title,
    p_description: description,
    p_questions: questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      choices: q.choices,
    })),
  });
export async function duplicate(s: Survey) {
  return saveSurvey(
    null,
    `Copy of ${s.title}`.slice(0, 200),
    s.description,
    s.questions.map((q) => ({
      ...q,
      key: crypto.randomUUID(),
      choices: q.choices.map((c) => c.choice_text),
    })),
  );
}
export function browserToken(): string {
  const key = "classroom.anonymous-token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}
