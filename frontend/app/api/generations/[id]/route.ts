import { proxy } from "@/lib/bff";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
 const { id } = await context.params;
 if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: { message: "Item not found." } }, { status: 404 });
 return proxy(request, `/api/generations/${id}`);
}
