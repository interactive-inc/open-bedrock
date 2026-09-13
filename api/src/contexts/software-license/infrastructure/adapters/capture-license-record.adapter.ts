import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'software-license-record', 'version', 1,
  'license', json_object('id', id, 'name', name, 'vendor', vendor, 'plan_name', plan_name,
    'revision', revision, 'category', category, 'seats', seats, 'renewal_deadline', renewal_deadline,
    'owner_employee_id', owner_employee_id, 'note', note, 'status', status, 'created_at', created_at),
  'changes', (SELECT json_group_array(json_object('id',id,'license_id',license_id,
    'actor_account_id',actor_account_id,'recorded_at',recorded_at,'command_id',command_id,
    'request_json',request_json,'before_json',before_json,'after_json',after_json))
    FROM (SELECT * FROM software_license_changes WHERE license_id = ?1 ORDER BY recorded_at,id)),
  'assignments', (SELECT json_group_array(json_object('id',id,'license_id',license_id,
    'employee_id',employee_id,'service_name',service_name,'plan_name',plan_name,
    'account_reference',account_reference,'assigned_at',assigned_at,'assigned_by',assigned_by,
    'assigned_reason',assigned_reason,'released_at',released_at,'released_by',released_by,'release_reason',release_reason))
    FROM (SELECT * FROM software_license_assignments WHERE license_id = ?1 ORDER BY assigned_at,id))
) AS snapshot_json FROM software_licenses WHERE id = ?1`

type Context = SoftwareLicenseContext

/** 管理資格のある主体へ原台帳と履歴を返し、保全までの変更・資格失効を検出する。 */
export class CaptureLicenseRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ licenseId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.licenseId) || input.licenseId < 1)
      return new LicenseError("forbidden", "invalid source record")
    const actor = await new LicenseActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.licenseId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("license source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("license source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "software-license",
        recordKind: "license-record",
        recordId: String(input.licenseId),
        formatId: "software-license-record",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return {
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "software-license",
          kind: "record-snapshot",
          id: String(input.licenseId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.licenseId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("license source capture failed", { cause })
    }
  }
}
