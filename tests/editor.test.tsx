// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Editor from "../src/pages/Editor";
const api = vi.hoisted(() => ({
  saveSurvey: vi.fn(),
  rpc: vi.fn(),
  getSurvey: vi.fn(),
  getResponses: vi.fn(),
}));
vi.mock("../src/lib/api", () => ({
  ...api,
  message: (error: Error) => error.message,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Location() {
  return <output>{useLocation().pathname}</output>;
}
const persisted = {
  id: "saved-1",
  title: "Saved survey",
  description: "",
  status: "draft",
  questions: [
    {
      id: "q",
      question_text: "Question",
      question_type: "true_false",
      choices: [{ choice_text: "True" }, { choice_text: "False" }],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  api.getSurvey.mockResolvedValue(persisted);
  api.getResponses.mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function mount(path = "/surveys/new") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/surveys/new" element={<Editor />} />
          <Route path="/surveys/:id/edit" element={<Editor />} />
          <Route path="/surveys/:id/present" element={<p>Presented</p>} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
async function submit(value: "activate" | "draft") {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(
        new SubmitEvent("submit", {
          bubbles: true,
          cancelable: true,
          submitter: host.querySelector(`button[value="${value}"]`),
        }),
      );
  });
}
it("reuses a saved survey and durable edit URL after activation fails", async () => {
  api.saveSurvey.mockResolvedValue("saved-1");
  api.rpc
    .mockRejectedValueOnce(new Error("Network interrupted"))
    .mockResolvedValueOnce(undefined);
  await mount();
  await submit("activate");
  expect(host.querySelector("output")?.textContent).toBe(
    "/surveys/saved-1/edit",
  );
  expect(host.textContent).toContain("Your survey was saved");
  expect(host.textContent).toContain("Network interrupted");
  await submit("activate");
  expect(api.saveSurvey.mock.calls.map((call) => call[0])).toEqual([
    null,
    "saved-1",
  ]);
  expect(api.rpc.mock.calls.map((call) => call[1].p_survey_id)).toEqual([
    "saved-1",
    "saved-1",
  ]);
  expect(host.textContent).toContain("Presented");
});
it("keeps a new survey unsaved when saving fails before activation", async () => {
  api.saveSurvey
    .mockRejectedValueOnce(new Error("Save failed"))
    .mockResolvedValueOnce("saved-1");
  api.rpc.mockResolvedValue(undefined);
  await mount();
  await submit("activate");
  expect(api.rpc).not.toHaveBeenCalled();
  expect(host.querySelector("output")?.textContent).toBe("/surveys/new");
  await submit("activate");
  expect(api.saveSurvey.mock.calls.map((call) => call[0])).toEqual([
    null,
    null,
  ]);
  expect(host.textContent).toContain("Presented");
});
it("still saves an unchanged closed survey when Save draft is selected", async () => {
  api.getSurvey.mockResolvedValue({ ...persisted, status: "closed" });
  api.saveSurvey.mockResolvedValue("saved-1");
  await mount("/surveys/saved-1/edit");
  expect(host.querySelector(".badge")?.textContent).toBe("closed");
  await submit("draft");
  expect(api.saveSurvey).toHaveBeenCalledWith(
    "saved-1",
    "Saved survey",
    "",
    expect.any(Array),
  );
  expect(api.rpc).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Dashboard");
});
