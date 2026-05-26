export interface AuthUser {
  id: number;
  name: string;
  email: string;
  photoUrl?: string | null;
  role: "user" | "admin";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface PageSharedProps {
  auth: { user: AuthUser | null };
  flash: { success?: string; error?: string; status?: string };
  csrf_token: string;
}
