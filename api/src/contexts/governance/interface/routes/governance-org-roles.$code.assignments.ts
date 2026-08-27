import { AssignGovernanceOrgRole } from "@/contexts/governance/application/assign-governance-org-role"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { parseGovernanceCode } from "@/api/http/utils/parse-governance-code"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const request = z.strictObject({
  employee_code: z.string().min(1).max(100),
  department_code: z.string().min(1).max(100).nullable().optional(),
  starts_on: z.string(),
  ends_on: z.string().nullable().optional(),
  source_document_code: z.string().min(2).max(120).nullable().optional(),
})

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(verifyBearer, zValidator("json", request), async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  if (code === null) throw new NotFoundError("governance organization role not found")
  const body = c.req.valid("json")
  const result = await new AssignGovernanceOrgRole({
    context: c,
    prepareAudit: (audit) => prepareGovernanceAudit({ c, ...audit }),
  }).execute({
    session,
    orgRoleCode: code,
    employeeCode: body.employee_code,
    departmentCode: body.department_code ?? null,
    startsOn: body.starts_on,
    endsOn: body.ends_on ?? null,
    sourceDocumentCode: body.source_document_code ?? null,
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 201)
})
