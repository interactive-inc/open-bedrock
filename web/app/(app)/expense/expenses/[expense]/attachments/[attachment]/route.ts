import { downloadExpenseAttachment } from "@/lib/api/download-expense-attachment"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

const noStoreHeaders = { "Cache-Control": "no-store" }

const forwardedHeaders = ["Content-Type", "Content-Disposition", "X-Request-ID"] as const

function safeError(status: number): Response {
  return Response.json(
    { error: status === 404 ? "添付が見つかりません。" : "添付を取得できませんでした。" },
    { status, headers: noStoreHeaders },
  )
}

type Params = { params: Promise<{ expense: string; attachment: string }> }

/**
 * 添付ダウンロードの中継。ブラウザは API のトークンを持たないため、
 * session cookie を Bearer に載せ替えてサーバー側から取りに行く。
 */
export async function GET(_request: Request, context: Params): Promise<Response> {
  const params = await context.params

  const expenseId = toPositiveIntId(params.expense)

  if (expenseId === null) return safeError(404)

  let upstream: Response

  try {
    upstream = await downloadExpenseAttachment(expenseId, params.attachment)
  } catch {
    return safeError(503)
  }

  if (upstream.status >= 400) return safeError(upstream.status === 404 ? 404 : 403)

  const headers = new Headers(noStoreHeaders)

  for (const name of forwardedHeaders) {
    const value = upstream.headers.get(name)

    if (value !== null) headers.set(name, value)
  }

  return new Response(upstream.body, { status: 200, headers })
}
