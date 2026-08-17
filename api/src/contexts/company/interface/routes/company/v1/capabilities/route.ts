import { createFactory } from "hono/factory"

const factory = createFactory()

export const COMPANY_API_VERSION = "company/v1" as const

export const COMPANY_CORE_CAPABILITIES = [
  "account-employee-link",
  "collective-body",
  "company-profile",
  "employee",
  "employment",
  "grade",
  "legal-entity",
  "organization",
  "organizational-authority",
  "person",
  "personnel-action",
  "position",
  "responsibility",
] as const

// @authorization authenticated - capability catalog contains no company data
export const GET = factory.createHandlers((context) =>
  context.json(
    {
      apiVersion: COMPANY_API_VERSION,
      capabilities: COMPANY_CORE_CAPABILITIES,
    },
    200,
  ),
)
