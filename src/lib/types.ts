export type Status = "draft" | "active" | "closed" | "archived";
export interface Choice {
  id: string;
  choice_text: string;
  position: number;
}
export interface Question {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  position: number;
  choices: Choice[];
}
export interface Survey {
  id: string;
  title: string;
  description: string;
  status: Status;
  public_slug: string;
  created_at: string;
  updated_at: string;
  questions: Question[];
}
export interface Response {
  id: string;
  submitted_at: string;
  answers: { question_id: string; choice_id: string }[];
}
export interface DraftQuestion {
  key: string;
  question_text: string;
  question_type: Question["question_type"];
  choices: string[];
}
