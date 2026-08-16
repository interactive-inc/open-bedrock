import type { Context } from "@/env"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { orgMemberships } from "@/contexts/company/infrastructure/schema/organization"
import { eq } from "drizzle-orm"

export type Props = {
  c: Context
  departmentCode: string
}

/**
 * 指定部署に所属(主配属・兼務とも)する従業員 id の一覧を org_memberships から解決する。
 * 下位部署は含まない(部署スコープの既存規約)。部署が存在しない場合も空配列を返す。
 */
export async function listDepartmentEmployeeIds(props: Props): Promise<Array<number> | Error> {
  try {
    const rows = await props.c.var.database
      .select({ id: employees.id })
      .from(orgMemberships)
      .innerJoin(employees, eq(employees.code, orgMemberships.employeeCode))
      .where(eq(orgMemberships.departmentCode, props.departmentCode))

    return rows.map((row) => row.id)
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to list department employees")
  }
}
