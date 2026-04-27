import { apiRequest } from "@/services/client";
import type {
  EmailCodeLoginPayload,
  AuthUser,
  LoginResponse,
  PasswordLoginPayload,
  PhoneCodeLoginPayload,
  RegisterPayload,
  RegisterEmailSendCodePayload,
  RegisterPhoneSendCodePayload,
  SendCodeResponse,
  SendEmailCodePayload,
  SendPhoneCodePayload,
} from "@/types/auth";

export const authService = {
  sendRegisterPhoneCode(payload: RegisterPhoneSendCodePayload) {
    return apiRequest<SendCodeResponse>("/auth/register/send-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

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
