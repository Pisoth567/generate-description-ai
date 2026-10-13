import { proxy } from "@/lib/bff";
export function GET(request: Request) { return proxy(request, "/api/payments"); }
export function POST(request: Request) { return proxy(request, "/api/payments"); }
