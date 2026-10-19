export interface User {
  id: number;
  email: string;
  is_active: boolean;
  google_linked: boolean;
  email_verified_at: string | null;
  ui_language: "en" | "km";
  created_at: string;
  updated_at: string;
}
export type AuthMeResponse = User;
export interface LoginRequest {
  email: string;
  password: string;
}
export type RegisterRequest = LoginRequest;
export interface Generation {
  id: number;
  product_name: string;
  category: string | null;
  generated_text: string;
  tone: string;
  language: string;
  tokens_used: number;
  created_at: string;
}
export interface GenerationResult {
  generation_id: number;
  description: string;
  tone: string;
  language: string;
  tokens_used: number;
}
