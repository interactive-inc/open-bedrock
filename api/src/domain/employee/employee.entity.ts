import { employeeStatusSchema } from "@/contexts/company/domain/employee/employee-status"
import type { EmployeeRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  // 外部 identity プロビジョニングで作られる従業員は社員コードを持たない（DB 上 null 許容、
  // migration 0029）。認証などの読取経路がそうした行を Employee として読み戻すため、code は
  // 誠実に null 許容とする。code で従業員を一意特定する経路は非 null の引数で引くため影響しない。
  code: z.string().nullable(),
  name: z.string(),
  deptId: z.number().nullable(),
  deptName: z.string().nullable(),
  position: z.string().nullable(),
  status: employeeStatusSchema,
  phone: z.string().nullable(),
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

  readonly phone!: Props["phone"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(
    row: Pick<
      EmployeeRow,
      "id" | "code" | "name" | "deptId" | "deptName" | "position" | "status" | "phone"
    >,
  ): Employee {
    return new Employee({
      id: row.id,
      code: row.code,
      name: row.name,
      deptId: row.deptId,
      deptName: row.deptName,
      position: row.position,
      status: row.status,
      phone: row.phone,
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

  /** 本人が自己申告する電話番号を差し替えた新しい従業員を返す。 */
  withPhone(phone: Props["phone"]) {
    return new Employee({ ...this.props, phone })
  }
}
