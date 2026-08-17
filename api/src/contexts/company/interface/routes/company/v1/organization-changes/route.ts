import { ApplyOrganizationChange } from "@/contexts/company/application/workforce/apply-organization-change"
import { OrganizationChangeRepository } from "@/contexts/company/infrastructure/workforce/organization-change.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { CanonicalCompanyAccess } from "@/contexts/company/interface/utils/canonical-company-access"
import { factory } from "@/contexts/company/interface/utils/factory"
import { requireCanonicalCompany } from "@/contexts/company/interface/utils/require-canonical-company"
import {
  toOrganizationChangeSet,
  wireOrganizationChangeSchema,
} from "@/contexts/company/interface/utils/wire-organization-change"
import { zAppCompanyOrganizationChange } from "@/lib/app-schemas"
import { ConflictError, UnavailableError, UnprocessableError, ValidationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"

// @authorization service - Technical PermissionとPEOPLE_OPERATIONS責務を合成する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", wireOrganizationChangeSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("employee:lifecycle:apply")) throw new ForbiddenError()
    const body = c.req.valid("json")
    const idempotencyKey = c.req.header("Idempotency-Key")
    if (idempotencyKey === undefined || idempotencyKey !== body.operation_id) {
      throw toHttpException(
        new ValidationError(
          "Idempotency-Key must equal operation_id",
          "organization_operation_id_mismatch",
        ),
      )
    }

    const change = toOrganizationChangeSet(body, String(session.accountId))
    await requireCanonicalCompany(c, change.asOf)
    const authorization = await new CanonicalCompanyAccess({
      c,
      session,
    }).authorizeOrganizationChange(change.asOf)
    if (authorization.kind === "denied") throw new ForbiddenError()
    if (authorization.kind === "invalid") {
      throw toHttpException(
        new UnavailableError("Company authority is inconsistent", "company_authority_invalid"),
      )
    }
    if (authorization.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError("Company authority is unavailable", "company_authority_unavailable", {
          cause: authorization.cause,
        }),
      )
    }
    const result = await new ApplyOrganizationChange({
      organization: new OrganizationUnitReadRepository(c.var.database),
      workforce: new OrganizationWorkforceSnapshotRepository(c),
      writer: new OrganizationChangeRepository(c.var.database),
    }).execute(change)
    if (result.kind === "conflict") {
      return c.json(
        {
          error: "organization revision changed",
          code: "organization_revision_conflict",
          actual_organization_revision: result.actualRevision,
        },
        409,
      )
    }
    if (result.kind === "operation_conflict") {
      throw toHttpException(
        new ConflictError(
          "operation_id was already used for another command",
          "organization_operation_conflict",
        ),
      )
    }
    if (result.kind === "invalid") {
      throw toHttpException(
        new UnprocessableError("organization change is invalid", result.error.code),
      )
    }
    if (result.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError(
          "organization change is unavailable",
          "organization_change_unavailable",
          { cause: result.cause },
        ),
      )
    }

    return c.json(
      zAppCompanyOrganizationChange.parse({
        operation_id: change.operationId,
        organization_revision: result.revision,
        replayed: result.replayed,
      }),
      result.replayed ? 200 : 201,
    )
  },
)
