import { ApplyEmployeeResourceAdoptionBatch } from "@/contexts/company/application/employees/apply-employee-resource-adoption-batch"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { EmployeeResourceAdoptionBatchRepository } from "@/contexts/company/infrastructure/repositories/employee-resource-adoption/employee-resource-adoption-batch.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyBodyInvalidError,
  CompanyHeadersInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - Company管理者が確認した既存履歴を全員まとめて接続する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,200}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 100),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1500),
        employees: z
          .array(
            z
              .object({
                employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
                snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
              })
              .strict(),
          )
          .min(1)
          .max(250)
          .refine(
            (employees) =>
              new Set(employees.map((employee) => employee.employeeId)).size === employees.length,
          ),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const body = context.req.valid("json")
    const result = await new ApplyEmployeeResourceAdoptionBatch({
      actor,
      now: context.var.companyClock?.() ?? new Date(),
      repository: new EmployeeResourceAdoptionBatchRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
    }).execute({
      ...body,
      commandId: context.req.valid("header")["idempotency-key"],
      observedOn: restoreCalendarDate(body.observedOn),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      z
        .object({
          employeeIds: z.array(z.string()),
          organizationRevision: z.number().int().positive(),
          replayed: z.boolean(),
        })
        .strict()
        .parse(result),
      200,
    )
  },
)
