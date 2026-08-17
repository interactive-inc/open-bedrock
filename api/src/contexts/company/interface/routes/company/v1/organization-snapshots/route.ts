import { createCompanyReadHandlers } from "@/contexts/company/interface/http/company-resource-http"

// @authorization service
export const GET = createCompanyReadHandlers([
  "organization-unit",
  "assignment",
  "reporting-relation",
  "organizational-authority",
])
