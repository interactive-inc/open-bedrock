import { employeeStatusSchema } from "@/contexts/company-compatibility/domain/employee/employee-status"
import { z } from "zod"

const employeePropsSchema = z.object({
  id: z.number(),
  // 外部 identity プロビジョニングで作られる従業員は社員コードを持たない。
  code: z.string().nullable(),
  name: z.string(),
  deptId: z.number().nullable(),
  deptName: z.string().nullable(),
  position: z.string().nullable(),
  status: employeeStatusSchema,
  phone: z.string().nullable(),
})

type EmployeeProps = z.infer<typeof employeePropsSchema>

/** Companyが所有する従業員台帳。永続化形式を知らない純粋なDomain Entity。 */
export class Employee implements EmployeeProps {
  readonly id!: EmployeeProps["id"]

  readonly code!: EmployeeProps["code"]

  readonly name!: EmployeeProps["name"]

  readonly deptId!: EmployeeProps["deptId"]

  readonly deptName!: EmployeeProps["deptName"]

  readonly position!: EmployeeProps["position"]

  readonly status!: EmployeeProps["status"]

  readonly phone!: EmployeeProps["phone"]

  private constructor(private readonly props: EmployeeProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static restore(input: EmployeeProps): Employee {
    return new Employee(employeePropsSchema.parse(input))
  }

  withStatus(status: EmployeeProps["status"]): Employee {
    return Employee.restore({ ...this.props, status })
  }

  /** 氏名・部署・役職・在籍状況を差し替えた新しい従業員を返す。 */
  withProfile(profile: {
    name: EmployeeProps["name"]
    deptId: EmployeeProps["deptId"]
    deptName: EmployeeProps["deptName"]
    position: EmployeeProps["position"]
    status: EmployeeProps["status"]
  }): Employee {
    return Employee.restore({ ...this.props, ...profile })
  }

  /** 本人が自己申告する電話番号を差し替えた新しい従業員を返す。 */
  withPhone(phone: EmployeeProps["phone"]): Employee {
    return Employee.restore({ ...this.props, phone })
  }
}
