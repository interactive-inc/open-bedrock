import { drizzle } from "drizzle-orm/d1"
import { HTTPException } from "hono/http-exception"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { POST as submit } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { GET as review } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number"
import { POST as withdraw } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number.withdraw"
import { POST as approve } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number.approve"
import { POST as reject } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number.reject"
import { POST as execute } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number.execute"
import { POST as resubmit } from "@/contexts/attendance/interface/routes/attendance-records.$id.preservation-requests.$number.resubmit"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"

/** 実認証、会社の期間付き責務、暗号化した保全本文を使う打刻APIのfixture。 */
export async function createAttendancePreservationFixture() {
  const governance = await createGovernanceTaskTestContext()
  const reviewer = governance.people[1]
  const assignment = governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (reviewer === undefined || assignment === undefined)
    throw new Error("missing approval fixture")
  await governance.write([
    {
      ...assignment,
      revision: 2,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: reviewer.employeeId,
        authorityScopeId: null,
      },
    },
  ])
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          ...governance.step,
          governance_authority: {
            organization_id: "organization:default",
            responsibility_code: "APPROVE",
            scope: null,
          },
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "attendance-preservation",
    revision: 1,
    title: "Preserve attendance",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.record.preserve",
    createdByAccountId: governance.creator.accountId,
    createdAt: governance.at,
  })
  if (definition instanceof Error) throw definition
  const published = await openSystemProcedures(governance.context).publish(definition, 0)
  if (published !== true) throw published
  const database = governance.database
  await database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:attendance-archive','attendance:archive','custom','Archive operator',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','attendance:read:all');`)
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:attendance-archive',?1,'role:attendance-archive',0)`)
    .bind(governance.creator.accountId)
    .run()
  await database
    .prepare(`INSERT INTO attendance_records
    (id,employee_id,work_date,clock_in_at,note,status) VALUES ('01900016-0000-7000-8000-000000000001',?1,'2026-09-01','2026-09-01T00:00:00Z','Original note','open')`)
    .bind(governance.creator.employeeId)
    .run()
  const bucket = new SystemAttachmentTestBucket()
  const secret = "attendance-preservation-test-secret"
  const settings = { sourceNamespace: "example-source" }
  const app = attendanceFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => new Date())
      c.set("database", drizzle(database))
      c.set("auditContext", {
        requestId: crypto.randomUUID(),
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      })
      await next()
    })
    .onError((error, c) => {
      if (error instanceof HTTPException) return c.json({ message: error.message }, error.status)
      throw error
    })
    .post("/attendance-records/:id/preservation-requests", ...submit)
    .post("/attendance-records/:id/preservation-requests/:number/resubmit", ...resubmit)
    .post("/attendance-records/:id/preservation-requests/:number/execute", ...execute)
    .post("/attendance-records/:id/preservation-requests/:number/approve", ...approve)
    .post("/attendance-records/:id/preservation-requests/:number/reject", ...reject)
    .get("/attendance-records/:id/preservation-requests/:number", ...review)
    .post("/attendance-records/:id/preservation-requests/:number/withdraw", ...withdraw)
  const keys = createSystemAttachmentTestKekEnvironment(1)
  const request = async (
    path: string,
    input: Readonly<{ body?: unknown; key?: string; anonymous?: boolean; accountId?: AccountId }>,
  ) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: input.accountId ?? governance.creator.accountId,
      tokenVersion: 0,
      now: new Date(),
    })
    if (token instanceof Error) throw token
    return app.request(
      path,
      {
        method: input.body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          ...(input.anonymous ? {} : { authorization: `Bearer ${token}` }),
          ...(input.key === undefined ? {} : { "idempotency-key": input.key }),
        },
        body: JSON.stringify(input.body),
      },
      {
        DB: database,
        JWT_SECRET: secret,
        COMPANY_TIME_ZONE: "Asia/Tokyo",
        RECORD_SOURCE_NAMESPACE: settings.sourceNamespace,
        ATTACHMENTS: bucket,
        ATTACHMENT_KEKS: keys,
      },
    )
  }
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold", retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  return {
    database,
    bucket,
    recordStorage: { ATTACHMENTS: bucket, ATTACHMENT_KEKS: keys },
    governance,
    reviewer,
    definition,
    settings,
    request,
    conditions,
    path: "/attendance-records/01900016-0000-7000-8000-000000000001/preservation-requests",
    command: { key: crypto.randomUUID(), body: { procedure_key: definition.key, conditions } },
  }
}
