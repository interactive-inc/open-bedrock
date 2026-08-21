import type { AccountId } from "@system/domain/values/account-id.schema"

export type CompanyBootstrapEmployeeWrite = Readonly<{
  accountId: AccountId
  employeeCode: string
  name: string
  occurredAt: Date
}>

export type CompanyBootstrapEmployeeResult = Readonly<{
  kind: "created" | "already_initialized"
  employeeId: number | null
  state: "complete" | "company_exists_without_account_link"
}>

/** 初期EmployeeとSystem Account linkだけを保存するCompany Application port。 */
export type CompanyBootstrapEmployeeRepository = Readonly<{
  provision: (
    write: CompanyBootstrapEmployeeWrite,
  ) => Promise<CompanyBootstrapEmployeeResult | Error>
}>
