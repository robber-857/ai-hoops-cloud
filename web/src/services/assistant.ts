import { apiRequest } from "./client";

export type CoachRecommendation = { title: string; kind: "task" | "exercise"; href: string };
export type CoachMessage = {
  turn: number;
  role: "user" | "assistant";
  content: string;
  recommendations: CoachRecommendation[];
  created_at: string;
};
export type ConversationSummary = {
  public_id: string;
  title: string;
  archived: boolean;
  turn_count: number;
  created_at: string;
  updated_at: string;
};
export type ConversationDetail = ConversationSummary & { messages: CoachMessage[]; has_more: boolean };
export type SendCoachQuestion = { request_id: string; content: string; expected_turn_count: number };
const base = "/me/assistant/conversations";
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const conversationPageSize = 20;

export const assistantService = {
  list(archived: boolean, page: number, signal: AbortSignal) {
    const offset = (page - 1) * conversationPageSize;
    return apiRequest<{ items: ConversationSummary[]; total: number }>(
      `${base}?archived=${archived}&limit=${conversationPageSize}&offset=${offset}`, { signal },
    );
  },
  get(id: string, signal: AbortSignal, beforeTurn?: number) {
    const query = beforeTurn === undefined ? "" : `?before_turn=${beforeTurn}`;
    return apiRequest<ConversationDetail>(path(id) + query, { signal });
  },
  send(id: string | undefined, question: SendCoachQuestion, signal: AbortSignal) {
    const { request_id, content } = question;
    return apiRequest<ConversationDetail>(id ? `${path(id)}/messages` : base, {
      method: "POST", signal, body: JSON.stringify(id ? question : { request_id, content }),
    });
  },
  archive(id: string, archived: boolean, signal: AbortSignal) {
    return apiRequest<ConversationSummary>(path(id), {
      method: "PATCH", signal, body: JSON.stringify({ archived }),
    });
  },
};
