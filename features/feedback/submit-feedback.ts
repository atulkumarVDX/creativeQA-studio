import type { FeedbackCaseStatus } from "@/features/feedback/create-feedback-bundle";

export type FeedbackSubmissionCase = {
  id: string;
  area: string;
  priority: "High" | "Medium";
  name: string;
  pass: string;
  status: FeedbackCaseStatus;
};

export type FeedbackSubmissionInput = {
  reviewer: string;
  appVersion: string;
  package: string;
  feedbackType: string;
  testCase: FeedbackSubmissionCase | null;
  productionReference: string;
  description: string;
  actualResult: string;
  expectedResult: string;
  reproductionSteps: string;
  bundleFilename: string;
  bundleUrl: string;
  evidenceSummary: string;
  supportingFiles: string[];
  pastedImages: string[];
};

type FeedbackSubmissionResponse = { error?: unknown };

function errorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as FeedbackSubmissionResponse).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return "Feedback could not be shared to Notion.";
}

export async function submitFeedback(input: FeedbackSubmissionInput): Promise<void> {
  const response = await fetch("/api/ctv-ott/notion/feedback-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(body));
}
