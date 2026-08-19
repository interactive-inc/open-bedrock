import { ProcessLifecycleOutbox } from "@/contexts/company/application/employee-lifecycle/process-lifecycle-outbox"
import { UpdateLifecycleTemplateBinding } from "@/contexts/onboarding/application/update-lifecycle-template-binding"
import { RemoveLifecycleTemplateBinding } from "@/contexts/onboarding/application/remove-lifecycle-template-binding"
import { createTestContext } from "@/api/test/support/create-test-context"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { ApplicationError, ForbiddenError, ValidationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function seedOutbox(
  db: D1Database,
  props: { actionId: string; employeeId: number; effectType: "hire" | "retired" },
) {
  await db
    .prepare("INSERT INTO employees (id, code, name, status) VALUES (?1, ?2, 'Fixture', ?3)")
    .bind(
      props.employeeId,
      `E${String(props.employeeId).padStart(3, "0")}`,
      props.effectType === "retired" ? "retired" : "active",
    )
    .run()
  await db
    .prepare(
      `INSERT INTO personnel_actions
         (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
          requested_by_employee_id, source_type, source_application_id,
          corrects_action_id, operation_id, payload_fingerprint, summary_json)
       VALUES (?1, ?2, ?3, '2026-01-01', 1, 1, 1, 'direct', NULL, NULL,
               ?1, ?4, '{}')`,
    )
    .bind(props.actionId, props.employeeId, props.effectType, "a".repeat(64))
    .run()
  await db
    .prepare(
      `INSERT INTO lifecycle_outbox_entries
         (personnel_action_id, effect_type, payload_json, attempt_count,
          next_attempt_at, processed_at, last_error_code, created_at)
       VALUES (?1, ?2, ?3, 0, 0, NULL, NULL, 0)`,
    )
    .bind(
      props.actionId,
      props.effectType,
      JSON.stringify({ actionId: props.actionId, employeeId: props.employeeId }),
    )
    .run()
}

async function seedTemplate(db: D1Database, props: { code: string; kind: "join" | "leave" }) {
  await db
    .prepare(
      "INSERT INTO onboarding_templates (code, name, kind, description) VALUES (?1, ?1, ?2, NULL)",
    )
    .bind(props.code, props.kind)
    .run()
  await db
    .prepare(
      `INSERT INTO onboarding_template_tasks
         (template_code, code, title, sort_order, owner_role)
       VALUES (?1, 'first-task', 'First task', 1, NULL)`,
    )
    .bind(props.code)
    .run()
}

describe("lifecycle onboarding effects", () => {
  test("binds a compatible template and atomically expands a hire once", async () => {
    const { context, db } = createTestContext()
    await seedTemplate(db, { code: "join-default", kind: "join" })
    await seedOutbox(db, { actionId: "action-hire", employeeId: 5, effectType: "hire" })
    const binding = await new UpdateLifecycleTemplateBinding(context).run({
      session: makeTestSession("root"),
      templateCode: "join-default",
      effectType: "hire",
    })
    expect(binding).not.toBeInstanceOf(ApplicationError)

    const first = await new ProcessLifecycleOutbox(context).run({
      session: makeTestSession("root"),
    })
    expect(first).toEqual({ processed: 1, skipped: 0, failed: 0 })
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM onboarding_assignments WHERE employee_id = 5")
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) FROM onboarding_tasks").first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT processed_at IS NOT NULL FROM lifecycle_outbox_entries")
        .first<number>("processed_at IS NOT NULL"),
    ).toBe(1)

    expect(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("root") }),
    ).toEqual({ processed: 0, skipped: 0, failed: 0 })
  })

  test("marks an unbound effect processed without creating an assignment", async () => {
    const { context, db } = createTestContext()
    await seedOutbox(db, { actionId: "action-retired", employeeId: 6, effectType: "retired" })
    expect(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("root") }),
    ).toEqual({ processed: 0, skipped: 1, failed: 0 })
    expect(
      await db.prepare("SELECT COUNT(*) FROM onboarding_assignments").first<number>("COUNT(*)"),
    ).toBe(0)
  })

  test("does not expand a template binding removed after the outbox row was selected", async () => {
    const { context, db } = createTestContext()
    await seedTemplate(db, { code: "join-default", kind: "join" })
    await seedOutbox(db, { actionId: "action-hire", employeeId: 5, effectType: "hire" })
    await new UpdateLifecycleTemplateBinding(context).run({
      session: makeTestSession("root"),
      templateCode: "join-default",
      effectType: "hire",
    })

    let intercepted = false
    context.env.DB = new Proxy(db, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (!intercepted) {
              intercepted = true
              await db
                .prepare(
                  "DELETE FROM lifecycle_effect_template_bindings WHERE effect_type = 'hire'",
                )
                .run()
            }
            return target.batch(statements)
          }
        }
        const value = Reflect.get(target, property)
        return typeof value === "function" ? value.bind(target) : value
      },
    })

    expect(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("root") }),
    ).toEqual({ processed: 0, skipped: 0, failed: 0 })
    expect(
      await db.prepare("SELECT COUNT(*) FROM onboarding_assignments").first<number>("COUNT(*)"),
    ).toBe(0)
    expect(
      await db
        .prepare("SELECT processed_at FROM lifecycle_outbox_entries")
        .first<number | null>("processed_at"),
    ).toBeNull()
  })

  test("rejects incompatible template kinds and callers without both batch permissions", async () => {
    const { context, db } = createTestContext()
    await seedTemplate(db, { code: "leave-default", kind: "leave" })
    expectApplicationError(
      await new UpdateLifecycleTemplateBinding(context).run({
        session: makeTestSession("root"),
        templateCode: "leave-default",
        effectType: "hire",
      }),
      ValidationError,
      "invalid_template_kind",
    )
    expectApplicationError(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("member") }),
      ForbiddenError,
      "forbidden",
    )
  })

  test("does not expand a corrupted payload for another employee or action", async () => {
    const { context, db } = createTestContext()
    await seedTemplate(db, { code: "join-default", kind: "join" })
    await seedOutbox(db, { actionId: "action-hire", employeeId: 5, effectType: "hire" })
    await new UpdateLifecycleTemplateBinding(context).run({
      session: makeTestSession("root"),
      templateCode: "join-default",
      effectType: "hire",
    })
    await db
      .prepare("UPDATE lifecycle_outbox_entries SET payload_json = ?1")
      .bind(JSON.stringify({ actionId: "different-action", employeeId: 6 }))
      .run()

    expect(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("root") }),
    ).toEqual({ processed: 0, skipped: 0, failed: 1 })
    expect(
      await db.prepare("SELECT COUNT(*) FROM onboarding_assignments").first<number>("COUNT(*)"),
    ).toBe(0)
  })

  test("does not mark an orphaned template binding as processed", async () => {
    const { context, db } = createTestContext()
    await seedOutbox(db, { actionId: "action-hire", employeeId: 5, effectType: "hire" })
    await db
      .prepare(
        `INSERT INTO lifecycle_effect_template_bindings
           (effect_type, template_code, updated_at, updated_by_account_id)
         VALUES ('hire', 'missing-template', 1, NULL)`,
      )
      .run()

    expect(
      await new ProcessLifecycleOutbox(context).run({ session: makeTestSession("root") }),
    ).toEqual({ processed: 0, skipped: 0, failed: 1 })
  })

  test("removes a lifecycle template binding with onboarding management permission", async () => {
    const { context, db } = createTestContext()
    await seedTemplate(db, { code: "join-default", kind: "join" })
    await new UpdateLifecycleTemplateBinding(context).run({
      session: makeTestSession("root"),
      templateCode: "join-default",
      effectType: "hire",
    })

    expect(
      await new RemoveLifecycleTemplateBinding(context).run({
        session: makeTestSession("root"),
        templateCode: "join-default",
      }),
    ).toEqual({ removed: true })
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM lifecycle_effect_template_bindings")
        .first<number>("COUNT(*)"),
    ).toBe(0)
    expectApplicationError(
      await new RemoveLifecycleTemplateBinding(context).run({
        session: makeTestSession("member"),
        templateCode: "join-default",
      }),
      ForbiddenError,
      "forbidden",
    )
  })
})
