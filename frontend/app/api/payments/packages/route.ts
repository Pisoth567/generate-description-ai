import { proxy } from "@/lib/bff";
export function GET(request: Request) { return proxy(request, "/api/payments/packages"); }
