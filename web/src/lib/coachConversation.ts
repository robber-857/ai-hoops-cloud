import type { CoachMessage, SendCoachQuestion } from "@/services/assistant";

export function mergeCoachMessages(older: CoachMessage[], newer: CoachMessage[]) {
  const messages = new Map<string, CoachMessage>();
  for (const item of [...older, ...newer]) messages.set(`${item.turn}:${item.role}`, item);
  return [...messages.values()].sort((a, b) => a.turn - b.turn || Number(a.role === "assistant") - Number(b.role === "assistant"));
}

// Only an unconfirmed send is kept in this tab. The account owns all saved history on the server.
export function pendingQuestionKey(owner: string, id?: string) {
  return `ai-coach:pending:${encodeURIComponent(owner)}:${id ? encodeURIComponent(id) : "new"}`;
}

export function readPendingQuestion(key: string): SendCoachQuestion | null {
  try {
    const item = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return item && typeof item.content === "string" && typeof item.request_id === "string" &&
      Number.isInteger(item.expected_turn_count) && item.expected_turn_count >= 0 ? item : null;
  } catch { return null; }
}

export function storePendingQuestion(key: string, value: SendCoachQuestion | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* A same-page retry still uses the request held in memory. */ }
}
