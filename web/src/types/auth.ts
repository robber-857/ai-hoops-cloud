export interface AuthUser {
  id: number;
  username: string;
  phone_number: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RegisterPayload {
  username: string;
  password: string;
  confirm_password: string;
  phone_number: string;
  phone_code: string;
  email?: string;
  email_code?: string;
}

export interface RegisterPhoneSendCodePayload {
  phone_number: string;
}

export interface RegisterEmailSendCodePayload {
  email: string;
}

export interface SendPhoneCodePayload {
  phone_number: string;
}

export interface SendEmailCodePayload {
  email: string;
}

export interface PasswordLoginPayload {
  username: string;
  password: string;
}

export interface PhoneCodeLoginPayload {
  phone_number: string;
  code: string;
}

export interface EmailCodeLoginPayload {
  email: string;
  code: string;
}

export interface SendCodeResponse {
  message: string;
  data: {
    expire_seconds: number;
    target: string;
    debug_code?: string;
  };
}
