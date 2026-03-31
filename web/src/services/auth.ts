import { apiRequest } from "@/services/client";
import type {
  EmailCodeLoginPayload,
  LoginResponse,
  PasswordCodeLoginPayload,
  PhoneCodeLoginPayload,
  RegisterPayload,
  RegisterSendCodePayload,
  SendCodeResponse,
  SendEmailCodePayload,
  SendPhoneCodePayload,
} from "@/types/auth";

export const authService = {
  sendRegisterCode(payload: RegisterSendCodePayload) {
    return apiRequest<SendCodeResponse>("/auth/register/send-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: RegisterPayload) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  loginWithPasswordCode(payload: PasswordCodeLoginPayload) {
    return apiRequest<LoginResponse>("/auth/login/password-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  sendPhoneLoginCode(payload: SendPhoneCodePayload) {
    return apiRequest<SendCodeResponse>("/auth/login/phone/send-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  loginWithPhoneCode(payload: PhoneCodeLoginPayload) {
    return apiRequest<LoginResponse>("/auth/login/phone", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  sendEmailLoginCode(payload: SendEmailCodePayload) {
    return apiRequest<SendCodeResponse>("/auth/login/email/send-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  loginWithEmailCode(payload: EmailCodeLoginPayload) {
    return apiRequest<LoginResponse>("/auth/login/email", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
