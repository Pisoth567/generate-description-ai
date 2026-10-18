export interface User {
  id: number;
  email: string;
  plan: string;
  credits: number;
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
export interface Package {
  code: string;
  amount: string;
  currency: string;
  credits: number;
}
export interface Payment {
  id: number;
  tran_id: string;
  package_code: string;
  amount: string;
  currency: string;
  credits: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}
export interface PaymentCheckoutResponse {
  payment: Payment;
  checkout: {
    type: "aba_qr";
    qr_image: string;
    aba_deeplink: string;
    app_store_url: string | null;
    play_store_url: string | null;
  };
}
