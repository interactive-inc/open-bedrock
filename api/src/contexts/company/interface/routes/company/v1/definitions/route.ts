import {
  createCompanyReadHandlers,
  createCompanyWriteHandlers,
} from "@/contexts/company/interface/http/company-resource-http"

const types = ["position", "grade", "responsibility", "collective-body"] as const

// @authorization service
export const GET = createCompanyReadHandlers(types)
// @authorization service
export const POST = createCompanyWriteHandlers(types)
