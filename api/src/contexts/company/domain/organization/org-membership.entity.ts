import { z } from "zod"

/** Company Employeeの部署所属と直属管理者。 */
const zProps = z.object({
  departmentCode: z.string(),
  employeeCode: z.string(),
  managerEmployeeCode: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

export class OrgMembership implements Props {
  readonly departmentCode!: Props["departmentCode"]

  readonly employeeCode!: Props["employeeCode"]

  readonly managerEmployeeCode!: Props["managerEmployeeCode"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  updateManager(managerEmployeeCode: string | null) {
    return new OrgMembership({ ...this.props, managerEmployeeCode })
  }
}
