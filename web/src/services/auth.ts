import { apiRequest } from "@/services/client";
import type {
  EmailCodeLoginPayload,
  AuthUser,
  LoginResponse,
  PasswordLoginPayload,
  PhonePasswordLoginPayload,
  RegisterPayload,
  RegisterEmailSendCodePayload,
  SendCodeResponse,
  SendEmailCodePayload,
} from "@/types/auth";

export const authService = {
  sendRegisterEmailCode(payload: RegisterEmailSendCodePayload) {
    return apiRequest<SendCodeResponse>("/auth/register/email/send-code", {
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

  loginWithPassword(payload: PasswordLoginPayload) {
    return apiRequest<LoginResponse>("/auth/login/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  loginWithPhonePassword(payload: PhonePasswordLoginPayload) {
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

  getCurrentUser() {
    return apiRequest<AuthUser>("/auth/me", {
      method: "GET",
    });
  },

  logout() {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
    });
  },
};
