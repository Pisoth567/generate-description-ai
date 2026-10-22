import { proxy } from "@/lib/bff";
export function PATCH(request: Request) {
  return proxy(request, "/api/profile/avatar");
}
