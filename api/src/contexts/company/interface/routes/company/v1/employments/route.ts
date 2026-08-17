import {
  createCompanyReadHandlers,
  createCompanyWriteHandlers,
} from "@/contexts/company/interface/http/company-resource-http"

const types = ["employment"] as const

// @authorization service
export const GET = createCompanyReadHandlers(types)
// @authorization service
export const POST = createCompanyWriteHandlers(types)
