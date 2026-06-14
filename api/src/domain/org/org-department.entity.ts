import { z } from "zod"

const zProps = z.object({
  code: z.string(),
  departmentId: z.number(),
  parentCode: z.string().nullable(),
  managerEmployeeCode: z.string().nullable(),
  order: z.number(),
})

type Props = z.infer<typeof zProps>

export class OrgDepartment implements Props {
  readonly code!: Props["code"]

  readonly departmentId!: Props["departmentId"]

  readonly parentCode!: Props["parentCode"]

  readonly managerEmployeeCode!: Props["managerEmployeeCode"]

  readonly order!: Props["order"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: Props) {
    return new OrgDepartment(props)
  }

  updateOrder(order: number) {
    return new OrgDepartment({ ...this.props, order })
  }

  updateManager(managerEmployeeCode: string | null) {
    return new OrgDepartment({ ...this.props, managerEmployeeCode })
  }

  withParent(parentCode: string | null) {
    return new OrgDepartment({ ...this.props, parentCode })
  }
}
