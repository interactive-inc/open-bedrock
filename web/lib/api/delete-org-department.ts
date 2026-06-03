import { createClient } from "@/lib/api/hc-client"

// DELETE /org/departments/:code。部署ノードを削除する。
// 権限不足は 403、不存在は 404、子や所属が残る場合は 409 を api が返すため Error。成功時は null。
export async function deleteOrgDepartment(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.org.departments[":code"].$delete({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to delete org department")
  }

  return null
}
