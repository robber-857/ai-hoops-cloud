import { apiRequest } from "@/services/client";

export type PlayerMeasurementInput = {
  request_id: string;
  date_of_birth: string;
  measured_on: string;
  height_cm: string;
  weight_kg: string;
  sex: "female" | "male" | null;
};
export type PlayerMeasurement = Omit<PlayerMeasurementInput, "request_id"> & {
  public_id: string;
  created_at: string;
};
export type PlayerMeasurementDraft = {
  values: Omit<PlayerMeasurementInput, "request_id" | "sex"> & {
    sex: "" | "female" | "male";
  };
  requestId: string | null;
};
export const playerProfileService = {
  history(offset = 0) {
    return apiRequest<{ items: PlayerMeasurement[]; has_more: boolean }>(
      `/me/profile/measurements?limit=20&offset=${offset}`,
    );
  },
  save(input: PlayerMeasurementInput) {
    return apiRequest<PlayerMeasurement>("/me/profile/measurements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
