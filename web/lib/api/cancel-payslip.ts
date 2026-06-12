import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /payslips/:id。特権ロールが給与明細を取り消す（記録の削除のみ）。
// 非特権は 403、不存在は 404 を api が返すため、戻りは Error。成功時は null。
export async function cancelPayslip(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.payslips[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "給与明細の取消に失敗しました",
      conflictMessages: {
        "only draft payslips can be cancelled": "下書きの給与明細のみ取消できます",
      },
    })
  }

  return null
}
