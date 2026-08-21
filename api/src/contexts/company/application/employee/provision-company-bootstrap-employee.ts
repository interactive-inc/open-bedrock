import type {
  CompanyBootstrapEmployeeRepository,
  CompanyBootstrapEmployeeResult,
} from "@/contexts/company/infrastructure/employee/company-bootstrap-employee-port.repository"
import type { AccountId } from "@system/domain/auth/account-id"
import { z } from "zod"

type Props = Readonly<{
  repository: CompanyBootstrapEmployeeRepository
}>

export type ProvisionCompanyBootstrapEmployeeCommand = Readonly<{
  accountId: AccountId
  employeeCode: string
  name: string
  now: Date
}>

export type ProvisionCompanyBootstrapEmployeeResult =
  | CompanyBootstrapEmployeeResult
  | Readonly<{ kind: "invalid_input" }>

/** System rootへ対応する最初のCompany Employeeを冪等に作る。 */
export class ProvisionCompanyBootstrapEmployee {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  execute(
    command: ProvisionCompanyBootstrapEmployeeCommand,
  ): Promise<ProvisionCompanyBootstrapEmployeeResult | Error> {
    const parsed = z
      .strictObject({
        employeeCode: z.string().trim().min(1).max(64),
        name: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine((value) => !value.includes("\0")),
        now: z.date().refine((value) => Number.isSafeInteger(value.getTime())),
      })
      .safeParse({ employeeCode: command.employeeCode, name: command.name, now: command.now })
    if (!parsed.success) return Promise.resolve(Object.freeze({ kind: "invalid_input" as const }))

    return this.props.repository.provision({
      accountId: command.accountId,
      employeeCode: parsed.data.employeeCode,
      name: parsed.data.name,
      occurredAt: parsed.data.now,
    })
  }
}
