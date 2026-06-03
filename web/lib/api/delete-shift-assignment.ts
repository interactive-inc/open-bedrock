import { createClient } from "@/lib/api/hc-client"

// DELETE /shift/assignments/:id。特権ロールが割当を削除する。成功時は null。
export async function deleteShiftAssignment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.shift.assignments[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete shift assignment")
  }

  return null
}
