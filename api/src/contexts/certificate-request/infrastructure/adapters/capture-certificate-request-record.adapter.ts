import type { CertificateRequestContext } from "@/contexts/certificate-request/configuration/certificate-request-context"
import { CertificateRequestActorReadAdapter } from "@/contexts/certificate-request/infrastructure/adapters/certificate-request-actor-read.adapter"
import { CertificateRequestError } from "@/contexts/certificate-request/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'certificate-request-record', 'version', 1,
  'certificate-request', json_object(
    'id', id,
    'requester_id', requester_id,
    'certificate_type', certificate_type,
    'submit_to', submit_to,
    'needed_by', needed_by,
    'note', note,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM certificate_requests WHERE id = ?1`

type Context = CertificateRequestContext

/** 管理資格のある主体へcertificate request原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureCertificateRequestRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ certificateRequestId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.certificateRequestId).success)
      return new CertificateRequestError("forbidden", "invalid source record")
    const actor = await new CertificateRequestActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.certificateRequestId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("certificate-request source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("certificate-request source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "certificate-request",
        recordKind: "certificate-request-record",
        recordId: String(input.certificateRequestId),
        formatId: "certificate-request-record",
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
          context: "certificate-request",
          kind: "record-snapshot",
          id: String(input.certificateRequestId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.certificateRequestId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("certificate-request source capture failed", { cause })
    }
  }
}
