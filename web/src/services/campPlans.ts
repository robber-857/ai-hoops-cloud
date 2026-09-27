import { apiRequest } from "@/services/client";
export type PlanItem = {
  name: string;
  sets: number | null;
  reps: number | null;
  duration_minutes: number | null;
  instructions: string | null;
  template_code: string | null;
  analysis_type?: string | null;
  template_version?: string | null;
};
export type PlanContent = {
  title: string;
  planned_on: string;
  focus: string;
  notes: string | null;
  items: PlanItem[];
};
export type CampPlan = PlanContent & {
  public_id: string;
  class_public_id: string;
  class_name: string;
  student_public_id: string | null;
  student_name: string | null;
  status: string;
  version: number;
  published_at: string | null;
  supersedes_public_id: string | null;
};
export type PlansResponse = { items: CampPlan[]; has_more: boolean };
const base = (id: string) => `/coach/classes/${id}/plans`;
export const campPlanService = {
  get: (id: string, planId: string) =>
    apiRequest<CampPlan>(`${base(id)}/${planId}`),
  mine: (offset = 0) => apiRequest<PlansResponse>(`/me/plans?offset=${offset}`),
  list: (id: string, offset = 0) =>
    apiRequest<PlansResponse>(`${base(id)}?offset=${offset}`),
  create: (
    id: string,
    input: PlanContent & {
      request_id: string;
      student_public_id: string | null;
      supersedes_public_id: string | null;
    },
  ) =>
    apiRequest<CampPlan>(base(id), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, plan: CampPlan, input: PlanContent) =>
    apiRequest<CampPlan>(`${base(id)}/${plan.public_id}`, {
      method: "PUT",
      body: JSON.stringify({ ...input, expected_version: plan.version }),
    }),
  publish: (plan: CampPlan) =>
    apiRequest<CampPlan>(
      `${base(plan.class_public_id)}/${plan.public_id}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ expected_version: plan.version }),
      },
    ),
};
