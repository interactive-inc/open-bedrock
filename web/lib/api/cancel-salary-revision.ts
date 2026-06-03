import { createClient } from "@/lib/api/hc-client"

// DELETE /salary-revisions/:id。特権ロールが既存の給与改定を取消する。
// api 側で特権ロール限定のため、権限不足時は 403 でエラーになる。
export async function cancelSalaryRevision(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["salary-revisions"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status !== 204) {
    return new Error("failed to cancel salary revision")
  }

  return null
}
