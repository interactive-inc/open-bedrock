export type CompanyCapability = "company:read" | "company:write" | "company:admin"

export type CompanyActor = Readonly<{
  accountId: string
  employeeId: string | null
  organizationIds: ReadonlyArray<string>
  capabilities: ReadonlyArray<CompanyCapability>
}>
