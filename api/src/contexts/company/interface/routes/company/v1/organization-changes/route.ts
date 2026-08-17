import { createCompanyWriteHandlers } from "@/contexts/company/interface/http/company-resource-http"

// @authorization service
export const POST = createCompanyWriteHandlers([
  "organization-unit",
  "assignment",
  "reporting-relation",
  "organizational-authority",
])
