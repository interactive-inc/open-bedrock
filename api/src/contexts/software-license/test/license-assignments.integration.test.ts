import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { licenseAssignmentSchema } from "@/contexts/software-license/domain/schemas/license-assignment.schema"
import { LicenseAssignmentRepository } from "@/contexts/software-license/infrastructure/repositories/license-assignment.repository"

afterEach(() => mock.restore())

describe("software license usage ledger", () => {
  test("deduplicates concurrent contract registrations and rejects changed retry content", async () => {
    const f = await createLicenseFixture()
    const command = {
      method: "POST",
      headers: { "idempotency-key": "registration:team" },
      body: {
        name: "Second Service",
        plan_name: "Basic",
        seats: 2,
      },
    }
    const responses = await Promise.all([
      f.request("/software-licenses", command),
      f.request("/software-licenses", command),
    ])
    expect(responses.map((response) => response.status)).toEqual([201, 201])
    expect(await responses[0]!.json()).toEqual(await responses[1]!.json())
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_licenses")
        .first<number>("count"),
    ).toBe(2)
    expect(
      (await f.request("/software-licenses", { ...command, body: { ...command.body, seats: 3 } }))
        .status,
    ).toBe(409)
  })

  test("admits only one competing assignment into the final seat", async () => {
    const f = await createLicenseFixture()
    const responses = await Promise.all(
      ["member", "other"].map((employee) =>
        f.request(`/software-licenses/${f.license.id}/assignments`, {
          method: "POST",
          body: { id: crypto.randomUUID(), employee_id: `employee:${employee}`, reason: "Work" },
        }),
      ),
    )
    expect(
      responses.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([201, 409])
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_license_assignments")
        .first<number>("count"),
    ).toBe(1)
  })

  test("concurrent retries create one assignment and one audit event", async () => {
    const f = await createLicenseFixture()
    const body = { id: crypto.randomUUID(), employee_id: "employee:member", reason: "Work" }
    const responses = await Promise.all(
      [1, 2].map(() =>
        f.request(`/software-licenses/${f.license.id}/assignments`, { method: "POST", body }),
      ),
    )
    expect(
      responses.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([200, 201])
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action='software_license.assignment.recorded'",
        )
        .first<number>("count"),
    ).toBe(1)
  })

  test("retired employees cannot receive new assignments but existing assignments can be released", async () => {
    const f = await createLicenseFixture()
    const id = crypto.randomUUID()
    const path = `/software-licenses/${f.license.id}/assignments`
    expect(
      (
        await f.request(path, {
          method: "POST",
          body: { id, employee_id: "employee:member", reason: "Work" },
        })
      ).status,
    ).toBe(201)
    await f.retire("member")
    expect(
      (
        await f.request(path, {
          method: "POST",
          body: { id: crypto.randomUUID(), employee_id: "employee:member", reason: "Work" },
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await f.request(`/software-licenses/assignments/${id}/release`, {
          method: "POST",
          body: { reason: "Departure" },
        })
      ).status,
    ).toBe(200)
    expect(
      (await f.request(`/software-licenses/${f.license.id}/cancel`, { method: "POST" })).status,
    ).toBe(200)
  })

  test("rejects a Company eligibility change between checking and saving", async () => {
    const f = await createLicenseFixture()
    const repository = new LicenseAssignmentRepository({ env: { DB: f.database } })
    const write = repository.write.bind(repository)
    spyOn(LicenseAssignmentRepository.prototype, "write").mockImplementationOnce(
      async (assignment, options) => {
        await f.retire("member")
        return write(assignment, options)
      },
    )
    expect(
      (
        await f.request(`/software-licenses/${f.license.id}/assignments`, {
          method: "POST",
          body: {
            id: crypto.randomUUID(),
            employee_id: "employee:member",
            reason: "Work",
          },
        })
      ).status,
    ).toBe(503)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_license_assignments")
        .first<number>("count"),
    ).toBe(0)
  })

  test("keeps an assignment active when release audit fails and rejects a backwards clock", async () => {
    const f = await createLicenseFixture()
    const id = crypto.randomUUID()
    expect(
      (
        await f.request(`/software-licenses/${f.license.id}/assignments`, {
          method: "POST",
          body: { id, employee_id: "employee:member", reason: "Work" },
        })
      ).status,
    ).toBe(201)
    const path = `/software-licenses/assignments/${id}/release`
    f.clock.now = new Date("2026-09-08T00:00:00Z")
    expect((await f.request(path, { method: "POST", body: { reason: "Departure" } })).status).toBe(
      400,
    )
    f.clock.now = new Date("2026-09-08T02:00:00Z")
    await f.database
      .exec(`CREATE TRIGGER fail_license_release_audit BEFORE INSERT ON system_audit_events
      WHEN NEW.action='software_license.assignment.released' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;`)
    expect((await f.request(path, { method: "POST", body: { reason: "Departure" } })).status).toBe(
      503,
    )
    expect(
      await f.database
        .prepare("SELECT released_at FROM software_license_assignments WHERE id=?1")
        .bind(id)
        .first<number>("released_at"),
    ).toBeNull()
  })

  test("guards stale plan versions and rolls back catalog changes when history is unavailable", async () => {
    const f = await createLicenseFixture()
    const path = `/software-licenses/${f.license.id}`
    expect(
      (
        await f.request(path, {
          method: "PUT",
          headers: { "if-match": '"0"' },
          body: { name: "Stale edit" },
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await f.request(path, {
          method: "PUT",
          headers: { "if-match": "garbage" },
          body: { name: "Invalid edit" },
        })
      ).status,
    ).toBe(400)
    await f.database.exec(
      `CREATE TRIGGER fail_license_history BEFORE INSERT ON software_license_changes BEGIN SELECT RAISE(ABORT,'history unavailable'); END;`,
    )
    expect((await f.request(path, { method: "PUT", body: { name: "Failed edit" } })).status).toBe(
      503,
    )
    expect(
      await f.database
        .prepare("SELECT name FROM software_licenses WHERE id=?1")
        .bind(f.license.id)
        .first<string>("name"),
    ).toBe("Example Service")
  })

  test("can disable the entire ledger and bounds list inputs", async () => {
    const f = await createLicenseFixture()
    expect((await f.request("/software-licenses/assignments?limit=101")).status).toBe(400)
    expect((await f.request("/software-licenses/assignments?offset=-1")).status).toBe(400)
    f.settings.enabled = "false"
    expect((await f.request("/software-licenses")).status).toBe(404)
    expect((await f.request("/software-licenses/assignments")).status).toBe(404)
    expect(
      (
        await f.request(`/software-licenses/${f.license.id}/assignments`, {
          method: "POST",
          body: {
            id: crypto.randomUUID(),
            employee_id: "employee:member",
            reason: "Work",
          },
        })
      ).status,
    ).toBe(404)
  })

  test("records the plan, assignee, actor, release and replay without losing history", async () => {
    const f = await createLicenseFixture()
    const body = {
      id: crypto.randomUUID(),
      employee_id: "employee:member",
      account_reference: "member@example.com",
      reason: "Team assignment",
    }
    const path = `/software-licenses/${f.license.id}/assignments`
    const first = await f.request(path, { method: "POST", body })
    expect(first.status).toBe(201)
    const assigned = licenseAssignmentSchema.parse(await first.json())
    expect(assigned.plan_name).toBe("Team")
    expect(String(assigned.assigned_by)).toBe("account:manager")
    expect(assigned.assigned_at).toBe(f.clock.now.getTime())
    expect((await f.request(path, { method: "POST", body })).status).toBe(200)
    expect(
      (await f.request(path, { method: "POST", body: { ...body, reason: "Changed command" } }))
        .status,
    ).toBe(409)
    f.clock.now = new Date("2026-09-08T02:00:00Z")
    const releasePath = `/software-licenses/assignments/${body.id}/release`
    const release = await f.request(releasePath, {
      method: "POST",
      body: { reason: "Work finished" },
    })
    expect(release.status).toBe(200)
    expect(licenseAssignmentSchema.parse(await release.json()).released_at).toBe(
      f.clock.now.getTime(),
    )
    expect(
      (await f.request(releasePath, { method: "POST", body: { reason: "Work finished" } })).status,
    ).toBe(200)
    expect((await f.request(path, { method: "POST", body })).status).toBe(200)
    expect(
      (await f.request(path, { method: "POST", body: { ...body, id: crypto.randomUUID() } }))
        .status,
    ).toBe(201)
    const rows = await f.request("/software-licenses/assignments?employee_id=employee%3Amember")
    const page = await rows.json()
    expect(page).toMatchObject({
      data: [
        expect.objectContaining({ employee_name: "member" }),
        expect.objectContaining({ employee_name: "member" }),
      ],
      has_more: false,
    })
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'software_license.assignment.%'",
        )
        .first<number>("count"),
    ).toBe(3)
  })

  test("rejects seat exhaustion, cancellation and shrinking an assigned plan", async () => {
    const f = await createLicenseFixture()
    const path = `/software-licenses/${f.license.id}`
    expect(
      (
        await f.request(`${path}/assignments`, {
          method: "POST",
          body: { id: crypto.randomUUID(), employee_id: "employee:member", reason: "Work" },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await f.request(`${path}/assignments`, {
          method: "POST",
          body: { id: crypto.randomUUID(), employee_id: "employee:other", reason: "Work" },
        })
      ).status,
    ).toBe(409)
    expect((await f.request(`${path}/cancel`, { method: "POST" })).status).toBe(409)
    expect(
      (await f.request(path, { method: "PUT", body: { name: "Example Service", seats: 0 } }))
        .status,
    ).toBe(409)
    expect(
      await f.database
        .prepare("SELECT seats FROM software_licenses WHERE id=?1")
        .bind(f.license.id)
        .first<number>("seats"),
    ).toBe(1)
  })

  test("rejects anonymous, unauthorized and missing assignees", async () => {
    const f = await createLicenseFixture()
    expect((await f.request("/software-licenses/assignments", { actor: null })).status).toBe(401)
    expect((await f.request("/software-licenses/assignments", { actor: "member" })).status).toBe(
      403,
    )
    const path = `/software-licenses/${f.license.id}/assignments`
    const body = { id: crypto.randomUUID(), employee_id: "employee:missing", reason: "Work" }
    expect((await f.request(path, { method: "POST", body })).status).toBe(400)
    expect(
      (
        await f.request(path, {
          method: "POST",
          actor: "member",
          body: { ...body, employee_id: "employee:member" },
        })
      ).status,
    ).toBe(403)
  })

  test("rolls back the assignment when required audit persistence fails", async () => {
    const f = await createLicenseFixture()
    await f.database.exec(`CREATE TRIGGER fail_license_audit BEFORE INSERT ON system_audit_events
      WHEN NEW.action='software_license.assignment.recorded' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;`)
    const body = { id: crypto.randomUUID(), employee_id: "employee:member", reason: "Work" }
    expect(
      (await f.request(`/software-licenses/${f.license.id}/assignments`, { method: "POST", body }))
        .status,
    ).toBe(503)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_license_assignments")
        .first<number>("count"),
    ).toBe(0)
  })

  test("rechecks permission changes inside the write transaction", async () => {
    const f = await createLicenseFixture()
    const repository = new LicenseAssignmentRepository({ env: { DB: f.database } })
    const write = repository.write.bind(repository)
    spyOn(LicenseAssignmentRepository.prototype, "write").mockImplementationOnce(
      async (assignment, options) => {
        await f.database
          .prepare("UPDATE system_role_bindings SET revoked_at=?1 WHERE id='license-test-binding'")
          .bind(f.clock.now.getTime())
          .run()
        return write(assignment, options)
      },
    )
    expect(
      (
        await f.request(`/software-licenses/${f.license.id}/assignments`, {
          method: "POST",
          body: {
            id: crypto.randomUUID(),
            employee_id: "employee:member",
            reason: "Work",
          },
        })
      ).status,
    ).toBe(503)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_license_assignments")
        .first<number>("count"),
    ).toBe(0)
  })

  test("preserves the original service and plan after a rename and prevents history edits", async () => {
    const f = await createLicenseFixture()
    const id = crypto.randomUUID()
    const path = `/software-licenses/${f.license.id}`
    expect(
      (
        await f.request(`${path}/assignments`, {
          method: "POST",
          body: { id, employee_id: "employee:member", reason: "Work" },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await f.request(path, {
          method: "PUT",
          body: { name: "Renamed Service", plan_name: "Business", seats: 2 },
        })
      ).status,
    ).toBe(200)
    expect(
      await f.database
        .prepare("SELECT service_name,plan_name FROM software_license_assignments WHERE id=?1")
        .bind(id)
        .first<{ service_name: string; plan_name: string }>(),
    ).toEqual({ service_name: "Example Service", plan_name: "Team" })
    expect((await f.request(`${path}/history`)).status).toBe(200)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM software_license_changes")
        .first<number>("count"),
    ).toBe(2)
    const deletion = await f.database
      .prepare("DELETE FROM software_license_assignments WHERE id=?1")
      .bind(id)
      .run()
      .catch((cause: unknown) => cause)
    const rewrite = await f.database
      .prepare("UPDATE software_license_assignments SET assigned_reason='rewrite' WHERE id=?1")
      .bind(id)
      .run()
      .catch((cause: unknown) => cause)
    expect(deletion).toBeInstanceOf(Error)
    expect(rewrite).toBeInstanceOf(Error)
    if (deletion instanceof Error) expect(deletion.message).toContain("history_immutable")
    if (rewrite instanceof Error) expect(rewrite.message).toContain("history_immutable")
  })
})
