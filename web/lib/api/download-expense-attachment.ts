import { getServerSession } from "@/lib/auth/get-server-session"

/**
 * GET /expenses/:id/attachments/:attachmentId。添付本体を API から取り出す。
 * 認可は API 側が親の経費の閲覧可否で判定するため、ここでは素通しでよい。
 */
export async function downloadExpenseAttachment(
  expenseId: number,
  attachmentId: string,
): Promise<Response> {
  const token = await getServerSession()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://bedrock.localhost"

  const headers: Record<string, string> = { "X-Open-Bedrock-Client": "web" }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(
    new URL(
      `/expense/expenses/${expenseId}/attachments/${encodeURIComponent(attachmentId)}`,
      baseUrl,
    ),
    { headers },
  )
}
