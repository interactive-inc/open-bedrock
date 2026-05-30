import { createClient } from "@/lib/api/hc-client"

// GET /org/departments/:code/members を session トークン付きで呼び、部署メンバー一覧を返す。
export async function getOrgDepartmentMembers(code: string) {
  const client = await createClient()

  const response = await client.org.departments[":code"].members.$get({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to load org department members")
  }

  return response.json()
}
