import { proxy } from "@/lib/bff";
export function POST(request: Request) { return proxy(request, "/api/auth/login"); }
