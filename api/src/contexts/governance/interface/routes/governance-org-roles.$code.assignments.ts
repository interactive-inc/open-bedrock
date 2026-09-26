import { AssignGovernanceOrgRole } from "@/contexts/governance/application/assign-governance-org-role"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { parseGovernanceCode } from "@/contexts/governance/interface/http/parse-governance-code"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

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
  const commandId = c.req.header("idempotency-key")
  const expectedRevision = Number(c.req.header("if-match"))
  if (
    commandId === undefined ||
    !/^\S{1,255}$/.test(commandId) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    throw toHttpException(
      new ValidationError("冪等キーと期待会社版が必要です", "governance_role_headers_invalid"),
    )
  }
  const result = await new AssignGovernanceOrgRole({
    assign: (props) =>
      new CompanyGovernanceRoleAssignmentWriteAdapter({
        actor: CompanyActorValue.restore({
          accountId: String(props.session.accountId),
          employeeId: String(props.session.employeeId),
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: ["company:write"],
        }),
        database: c.env.DB,
        auditStatements: prepareGovernanceAudit({
          c,
          session: props.session,
          action: "governance.org_role.assigned",
          targetType: "governance_org_role",
          targetId: props.responsibilityCode,
          metadata: {
            employee_code: props.employeeCode,
            department_code: props.departmentCode,
            starts_on: props.startsOn,
            ends_on: props.endsOn,
          },
        }),
      }).assign({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        commandId: props.commandId,
        expectedRevision: props.expectedRevision,
        responsibilityCode: props.responsibilityCode,
        responsibilityName: props.responsibilityName,
        cardinality: props.cardinality,
        employeeCode: props.employeeCode,
        departmentCode: props.departmentCode,
        startsOn: props.startsOn,
        endsOn: props.endsOn,
        sourceDocumentCode: props.sourceDocumentCode,
        recordedAt: new Date(c.env.NOW ?? Date.now()).getTime(),
      }),
  }).execute({
    session,
    commandId,
    expectedRevision,
    orgRoleCode: code,
    employeeCode: body.employee_code,
    departmentCode: body.department_code ?? null,
    startsOn: body.starts_on,
    endsOn: body.ends_on ?? null,
    sourceDocumentCode: body.source_document_code ?? null,
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  c.header("etag", `"${result.organizationRevision}"`)
  return c.json(result, result.replayed ? 200 : 201)
})
