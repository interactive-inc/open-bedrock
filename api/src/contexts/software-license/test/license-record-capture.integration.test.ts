import { ListLicenseRecordInventoryAdapter } from "@/contexts/software-license/infrastructure/adapters/list-license-record-inventory.adapter"
import { expect, test } from "bun:test"
import { CaptureLicenseRecordAdapter } from "@/contexts/software-license/infrastructure/adapters/capture-license-record.adapter"
import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RevalidateLicenseRecordSourceAdapter } from "@/contexts/software-license/infrastructure/adapters/revalidate-license-record-source.adapter"

test("source capture retains license and usage history and rejects changed source or revoked manager permission", async () => {
  const f = await createLicenseFixture()
  const adapter = new CaptureLicenseRecordAdapter({
    env: { DB: f.database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    var: {
      userId: "account:manager",
      accountTokenVersion: 0,
      permissions: new Set(),
      role: "",
      licenseSession: null,
      now: () => f.clock.now,
    },
  })
  const assignmentId = crypto.randomUUID()
  expect(
    (
      await f.request(`/software-licenses/${f.license.id}/assignments`, {
        method: "POST",
        body: { id: assignmentId, employee_id: "employee:member", reason: "Work" },
      })
    ).status,
  ).toBe(201)
  const captured = await adapter.prepare({
    licenseId: f.license.id,
    sourceNamespace: "example-source",
  })
  if (captured instanceof Error) throw captured
  expect(
    await PreservedRecordContentValue.create(captured.source, captured.content),
  ).not.toBeInstanceOf(Error)
  const body = JSON.parse(new TextDecoder().decode(captured.content))
  expect(body.license).toEqual(
    await f.database
      .prepare("SELECT * FROM software_licenses WHERE id=?1")
      .bind(f.license.id)
      .first(),
  )
  expect(body.changes).toEqual(
    (
      await f.database
        .prepare(
          "SELECT * FROM software_license_changes WHERE license_id=?1 ORDER BY recorded_at,id",
        )
        .bind(f.license.id)
        .all()
    ).results,
  )
  expect(body.assignments).toEqual(
    (
      await f.database
        .prepare(
          "SELECT * FROM software_license_assignments WHERE license_id=?1 ORDER BY assigned_at,id",
        )
        .bind(f.license.id)
        .all()
    ).results,
  )
  expect(body.license.name).toBe("Example Service")
  expect(body.changes).toHaveLength(1)
  expect(body.assignments[0].id).toBe(assignmentId)
  expect(captured.source.props.sourceRevision).toBeNull()
  await f.database.batch([...captured.assertions])
  expect(
    (
      await f.request(`/software-licenses/assignments/${assignmentId}/release`, {
        method: "POST",
        body: { reason: "Ended" },
      })
    ).status,
  ).toBe(200)
  expect(
    await f.database.batch([...captured.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const updated = await adapter.prepare({
    licenseId: f.license.id,
    sourceNamespace: "example-source",
  })
  if (updated instanceof Error) throw updated
  expect(updated.source.props.contentDigest).not.toBe(captured.source.props.contentDigest)
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'license:manage'",
  )
  expect(
    await f.database.batch([...updated.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await adapter.prepare({ licenseId: f.license.id, sourceNamespace: "example-source" }),
  ).toBeInstanceOf(Error)
})

test("license inventory includes all statuses and rejects additions before preservation completes", async () => {
  const f = await createLicenseFixture()
  const context = {
    env: { DB: f.database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    var: {
      userId: "account:manager",
      accountTokenVersion: 0,
      permissions: new Set<string>(),
      role: "",
      licenseSession: null,
      now: () => f.clock.now,
    },
  }
  const adapter = new ListLicenseRecordInventoryAdapter(context)
  const initial = await adapter.prepare()
  if (initial instanceof Error) throw initial
  expect(initial.licenseIds).toEqual([f.license.id])
  await f.database.batch([...initial.assertions])
  expect(
    (
      await f.request("/software-licenses", {
        method: "POST",
        headers: { "idempotency-key": "inventory:additional" },
        body: { name: "Second service", seats: 1 },
      })
    ).status,
  ).toBe(201)
  expect(
    await f.database.batch([...initial.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const current = await adapter.prepare()
  if (current instanceof Error) throw current
  expect(current.licenseIds).toHaveLength(2)
  expect(
    (
      await f.request(`/software-licenses/${f.license.id}/cancel`, {
        method: "POST",
        headers: { "if-match": String(f.license.revision) },
      })
    ).status,
  ).toBe(200)
  const afterCancel = await adapter.prepare()
  if (afterCancel instanceof Error) throw afterCancel
  expect(afterCancel.licenseIds).toEqual(current.licenseIds)
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='license:manage'",
  )
  expect(
    await f.database.batch([...afterCancel.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await adapter.prepare()).toBeInstanceOf(Error)
})

test("source revalidation preserves the approved capture time and rejects mismatched provenance, changes and revocation", async () => {
  const f = await createLicenseFixture()
  const context = {
    env: { DB: f.database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    var: {
      userId: "account:manager",
      accountTokenVersion: 0,
      permissions: new Set<string>(),
      role: "",
      licenseSession: null,
      now: () => f.clock.now,
    },
  }
  const captured = await new CaptureLicenseRecordAdapter(context).prepare({
    licenseId: f.license.id,
    sourceNamespace: "example-source",
  })
  if (captured instanceof Error) throw captured
  f.clock.now = new Date("2026-09-08T02:00:00Z")
  const adapter = new RevalidateLicenseRecordSourceAdapter({
    ...context,
    sourceNamespace: "example-source",
  })
  const verified = await adapter.prepare(captured.source)
  if (verified instanceof Error) throw verified
  expect(verified.source.props).toEqual(captured.source.props)
  expect(verified.content).toEqual(captured.content)
  expect(verified.sourceAuthorizationRef).toEqual(captured.sourceAuthorizationRef)
  await f.database.batch([...verified.assertions])

  for (const replacement of [
    { sourceNamespace: "other-source" },
    { ownerContext: "other-context" },
    { recordKind: "other-record" },
    { recordId: `0${f.license.id}` },
    { formatId: "other-format" },
    { formatVersion: 2 },
    { sourceRevision: "1" },
    { sourceRecordedAt: "2026-09-08T00:00:00Z" },
    { capturedAt: "2026-09-08T03:00:00Z" },
    { contentDigest: "0".repeat(64) },
  ]) {
    const changed = PreservedRecordSourceValue.create({ ...captured.source.props, ...replacement })
    if (changed instanceof Error) throw changed
    expect(await adapter.prepare(changed)).toBeInstanceOf(Error)
  }

  expect(
    await f.database
      .batch([
        f.database
          .prepare("UPDATE software_licenses SET note='Changed during finalization' WHERE id=?1")
          .bind(f.license.id),
        ...verified.assertions,
      ])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await adapter.prepare(captured.source)).not.toBeInstanceOf(Error)
  expect(
    (
      await f.request(`/software-licenses/${f.license.id}/cancel`, {
        method: "POST",
        headers: { "if-match": String(f.license.revision) },
      })
    ).status,
  ).toBe(200)
  expect(await adapter.prepare(captured.source)).toBeInstanceOf(Error)
  expect(
    await f.database.batch([...verified.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)

  const cancelled = await new CaptureLicenseRecordAdapter(context).prepare({
    licenseId: f.license.id,
    sourceNamespace: "example-source",
  })
  if (cancelled instanceof Error) throw cancelled
  expect(await adapter.prepare(cancelled.source)).not.toBeInstanceOf(Error)
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='license:manage'",
  )
  expect(await adapter.prepare(cancelled.source)).toBeInstanceOf(Error)
})
