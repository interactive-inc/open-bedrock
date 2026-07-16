import { employeeStatusSchema } from "@/lib/schemas"
import type { EmployeeRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  deptId: z.number().nullable(),
  deptName: z.string().nullable(),
  position: z.string().nullable(),
  status: employeeStatusSchema,
})

type Props = z.infer<typeof zProps>

export class Employee implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly deptId!: Props["deptId"]

  readonly deptName!: Props["deptName"]

  readonly position!: Props["position"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(
    row: Pick<EmployeeRow, "id" | "code" | "name" | "deptId" | "deptName" | "position" | "status">,
  ): Employee {
    return new Employee({
      id: row.id,
      code: row.code,
      name: row.name,
      deptId: row.deptId,
      deptName: row.deptName,
      position: row.position,
      status: row.status,
    })
  }

  withStatus(status: Props["status"]) {
    return new Employee({ ...this.props, status })
  }

  /** 氏名・部署・役職・在籍状況を差し替えた新しい従業員を返す。 */
  withProfile(profile: {
    name: Props["name"]
    deptId: Props["deptId"]
    deptName: Props["deptName"]
    position: Props["position"]
    status: Props["status"]
  }) {
    return new Employee({ ...this.props, ...profile })
  }
}
