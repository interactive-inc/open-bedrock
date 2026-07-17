import { createClient } from "@/lib/api/hc-client"

// GET /attendance?scope=department。指定部署の所属メンバー全員の勤怠記録を取得する。
// attendance:read:all、または本人が所属する部署への attendance:read:department が無いと api が 403 を返す。
export async function getDepartmentAttendances(departmentCode: string) {
  const client = await createClient()

  const response = await client.attendance.$get({
    query: {
      scope: "department",
      department_code: departmentCode,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load department attendances")
  }

  const body = await response.json()

  return body.data
}
