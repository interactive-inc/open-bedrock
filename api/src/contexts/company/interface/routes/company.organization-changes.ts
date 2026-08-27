/** /company/organization-changes */
import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyCommandConflictError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyInvariantValidationError,
  CompanyResourceConflictError,
  CompanyResourceOrganizationMismatchError,
  CompanyRevisionConflictError,
  CompanyWriteUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHeadersInvalidError(validation.error)
      }
    },
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2_000),
      resources: z
        .array(
          z.discriminatedUnion("type", [
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("organization-unit"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                  code: z.string().trim().min(1).max(64),
                  officialName: z.string().trim().min(1).max(200),
                  kind: z.enum(["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"]),
                  parentOrganizationUnitId: z
                    .string()
                    .regex(/^\S{1,255}$/)
                    .nullable(),
                })
                .catchall(z.json()),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("assignment"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                  assignmentType: z.enum(["PRIMARY", "CONCURRENT"]),
                  positionTitle: z.string().trim().min(1).max(200).nullable().optional(),
                })
                .catchall(z.json()),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("reporting-relation"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  managerEmployeeId: z.string().regex(/^\S{1,255}$/),
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                })
                .catchall(z.json()),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("organizational-authority"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  scopeType: z.literal("organization-unit"),
                  scopeId: z.string().regex(/^\S{1,255}$/),
                  authority: z.string().trim().min(1).max(255),
                })
                .catchall(z.json()),
            }),
          ]),
        )
        .min(1)
        .max(100),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyBodyInvalidError(validation.error)
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }

    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const organizationId = headers["x-company-organization-id"]
    if (body.resources.some((resource) => resource.organizationId !== organizationId)) {
      throw new CompanyResourceOrganizationMismatchError()
    }

    const change = {
      commandId: headers["idempotency-key"],
      expectedRevision: Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, "")),
      reason: body.reason,
      recordedAt: Date.now(),
      resources: body.resources.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes as CompanyJsonObject,
      })),
    }
    const applyOrganizationChange = new ApplyOrganizationChange({
      actor,
      repository: new D1CompanyResourceRepository(database),
    })
    const result = await applyOrganizationChange.execute(change)

    if (result.kind === "forbidden") {
      throw new CompanyAccessDeniedError()
    }
    if (result.kind === "invalid") {
      throw new CompanyInvariantValidationError(result.error.code, result.error)
    }
    if (result.kind === "conflict") {
      throw new CompanyRevisionConflictError(`"${result.actualRevision}"`)
    }
    if (result.kind === "resource_conflict") {
      throw new CompanyResourceConflictError()
    }
    if (result.kind === "command_conflict") {
      throw new CompanyCommandConflictError()
    }
    if (result.kind === "unavailable") {
      throw new CompanyWriteUnavailableError(result.cause)
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
