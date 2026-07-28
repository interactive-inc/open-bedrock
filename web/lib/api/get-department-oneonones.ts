import { createClient } from "@/lib/api/hc-client"

/**
 * GET /one-on-ones?scope=department。指定部署の所属メンバーが参加した 1on1 を取得する。
 * 本人が所属する部署への oneonone:read:department が無いと api が 403 を返す。
 */
export async function getDepartmentOneOnOnes(departmentCode: string) {
  const client = await createClient()

  const response = await client["one-on-ones"].$get({
    query: {
      scope: "department",
      department_code: departmentCode,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load department oneonones")
  }

  const body = await response.json()

  return body.data
}
