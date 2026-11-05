import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const teacher = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const questions = [
  {
    question_text: "What does recursion need?",
    question_type: "multiple_choice",
    choices: ["A base case", "A pointer"],
  },
  {
    question_text: "Every recursion needs a stop condition.",
    question_type: "true_false",
    choices: ["True", "False"],
  },
];
async function identity(role = "postgres", id = teacher) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role ${role};`,
  );
}
async function save(title = "Concept check") {
  const result = await db.query<{ id: string }>(
    "select save_survey(null,$1,$2,$3::jsonb) as id",
    [title, "Description", JSON.stringify(questions)],
  );
  return result.rows[0].id;
}
async function payload(id: string) {
  return (
    await db.query<{ question_id: string; choice_id: string }>(
      "select q.id as question_id,c.id as choice_id from questions q join choices c on c.question_id=q.id where q.survey_id=$1 and c.position=0 order by q.position",
      [id],
    )
  ).rows;
}
beforeAll(async () => {
  await db.exec(
    `create schema auth; create table auth.users(id uuid primary key); create role anon nologin; create role authenticated nologin; grant usage on schema public,auth to anon,authenticated; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; insert into auth.users values ('${teacher}'),('${other}');`,
  );
  await db.exec(readFileSync("supabase/migrations/001_classroom.sql", "utf8"));
  await db.exec(`insert into instructors values('${teacher}')`);
  await identity();
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("Real PostgreSQL schema and RPC security", () => {
  it("saves the full relational graph atomically and rejects malformed choices", async () => {
    const id = await save();
    expect(
      (await db.query("select * from questions where survey_id=$1", [id])).rows,
    ).toHaveLength(2);
    const before = (await db.query("select * from surveys")).rows.length;
    await expect(
      db.query("select save_survey(null,$1,$2,$3::jsonb)", [
        "Invalid",
        "",
        JSON.stringify([{ ...questions[0], choices: ["only"] }]),
      ]),
    ).rejects.toThrow("INVALID_CHOICES");
    expect((await db.query("select * from surveys")).rows).toHaveLength(before);
  });
  it("allows only one active survey and closes the prior survey", async () => {
    const first = await save("First");
    const second = await save("Second");
    await db.query("select activate_survey($1)", [first]);
    await db.query("select activate_survey($1)", [second]);
    expect(
      (await db.query("select * from surveys where status='active'")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from surveys where id=$1",
          [first],
        )
      ).rows[0].status,
    ).toBe("closed");
  });
  it("blocks anonymous table reads, mutations, and instructor RPCs", async () => {
    await identity("anon", "");
    await expect(db.query("select * from responses")).rejects.toThrow(
      "permission denied",
    );
    await expect(db.query("select * from surveys")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("insert into surveys(title) values('Intrusion')"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select activate_survey($1)", [teacher]),
    ).rejects.toThrow("permission denied");
    await identity();
  });
  it("denies signed-in users who are not explicitly instructors", async () => {
    await identity("authenticated", other);
    expect((await db.query("select * from surveys")).rows).toHaveLength(0);
    await expect(save()).rejects.toThrow("UNAUTHORIZED");
    await identity();
  });
  it("publishes only active questions, accepts anonymous answers, and prevents duplicates", async () => {
    const id = await save("Student test");
    await db.query("select activate_survey($1)", [id]);
    const answers = await payload(id);
    const slug = (
      await db.query<{ public_slug: string }>(
        "select public_slug from surveys where id=$1",
        [id],
      )
    ).rows[0].public_slug;
    await identity("anon", "");
    const published = (
      await db.query<{ s: { questions: unknown[] } }>(
        "select get_public_survey($1) as s",
        [slug],
      )
    ).rows[0].s;
    expect(published.questions).toHaveLength(2);
    expect(published).not.toHaveProperty("responses");
    await db.query("select submit_survey_response($1,$2,$3::jsonb)", [
      id,
      teacher,
      JSON.stringify(answers),
    ]);
    await expect(
      db.query("select submit_survey_response($1,$2,$3::jsonb)", [
        id,
        teacher,
        JSON.stringify(answers),
      ]),
    ).rejects.toThrow("DUPLICATE_RESPONSE");
    await identity();
    expect(
      (await db.query("select * from responses where survey_id=$1", [id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from answers where survey_id=$1", [id])).rows,
    ).toHaveLength(2);
  });
  it("rejects incomplete, repeated, foreign questions and foreign choices without partial writes", async () => {
    const id = await save("Validation");
    await db.query("select activate_survey($1)", [id]);
    const answers = await payload(id);
    const another = await save("Foreign");
    const foreign = await payload(another);
    for (const [data, code] of [
      [answers.slice(0, 1), "MISSING_REQUIRED_ANSWER"],
      [[answers[0], answers[0]], "INVALID_QUESTION"],
      [[foreign[0], answers[1]], "INVALID_QUESTION"],
      [
        [{ ...answers[0], choice_id: foreign[0].choice_id }, answers[1]],
        "INVALID_CHOICE",
      ],
    ] as const) {
      await expect(
        db.query("select submit_survey_response($1,$2,$3::jsonb)", [
          id,
          other,
          JSON.stringify(data),
        ]),
      ).rejects.toThrow(code);
    }
    expect(
      (await db.query("select * from responses where survey_id=$1", [id])).rows,
    ).toHaveLength(0);
  });
  it("refuses active editing and edits after responses; closing rejects new submissions", async () => {
    const id = await save("Lifecycle");
    await db.query("select activate_survey($1)", [id]);
    const answers = await payload(id);
    await expect(
      db.query("select save_survey($1,$2,$3,$4::jsonb)", [
        id,
        "New",
        "",
        JSON.stringify(questions),
      ]),
    ).rejects.toThrow("SURVEY_ACTIVE");
    await db.query("select submit_survey_response($1,$2,$3::jsonb)", [
      id,
      teacher,
      JSON.stringify(answers),
    ]);
    await db.query("select close_survey($1)", [id]);
    await expect(
      db.query("select submit_survey_response($1,$2,$3::jsonb)", [
        id,
        other,
        JSON.stringify(answers),
      ]),
    ).rejects.toThrow("SURVEY_NOT_ACTIVE");
    await expect(
      db.query("select save_survey($1,$2,$3,$4::jsonb)", [
        id,
        "New",
        "",
        JSON.stringify(questions),
      ]),
    ).rejects.toThrow("HAS_RESPONSES");
    await db.query("select archive_survey($1)", [id]);
    expect(
      (await db.query("select * from responses where survey_id=$1", [id])).rows,
    ).toHaveLength(1);
    await db.query("select delete_survey($1)", [id]);
    expect(
      (await db.query("select * from answers where survey_id=$1", [id])).rows,
    ).toHaveLength(0);
  });
  it("allows instructors to read results through RLS", async () => {
    await identity("authenticated");
    expect(
      (await db.query("select * from surveys")).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (await db.query("select * from responses")).rows.length,
    ).toBeGreaterThan(0);
    await identity();
  });
});
