import { createClient } from "@/lib/api/hc-client"

// DELETE /payslips/:id。特権ロールが給与明細を取り消す（記録の削除のみ）。
// 非特権は 403、不存在は 404 を api が返すため、戻りは Error。成功時は null。
export async function cancelPayslip(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.payslips[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel payslip")
  }

  return null
}
