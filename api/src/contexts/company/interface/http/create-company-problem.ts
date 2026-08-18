import type { CompanyHttpContext } from "@/contexts/company/interface/http/company-http-environment"

export function createCompanyProblem(
  context: Pick<CompanyHttpContext, "json">,
  status: 400 | 401 | 403 | 409 | 422 | 503,
  code: string,
  detail: string,
) {
  return context.json(
    {
      type: `https://company.invalid/problems/${code}`,
      title: code.replaceAll("_", " "),
      status,
      code,
      detail,
    },
    status,
    { "content-type": "application/problem+json" },
  )
}
