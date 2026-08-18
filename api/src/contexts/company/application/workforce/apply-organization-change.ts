import type {
  ApplyOrganizationChangeResult,
  OrganizationChangeReadPorts,
  OrganizationChangeReplayReadResult,
  OrganizationChangeSet,
  OrganizationChangeWritePort,
  OrganizationChangeWriteResult,
} from "@/contexts/company/application/workforce/organization-change"
import { ValidateOrganizationChange } from "@/contexts/company/application/workforce/validate-organization-change"

export class ApplyOrganizationChange {
  constructor(
    private readonly ports: OrganizationChangeReadPorts &
      Readonly<{ writer: OrganizationChangeWritePort }>,
  ) {
    Object.freeze(this)
  }

  async execute(change: OrganizationChangeSet): Promise<ApplyOrganizationChangeResult> {
    const replay = await this.ports.writer.findReplay(change).catch(
      (cause): OrganizationChangeReplayReadResult => ({
        ok: false,
        kind: "unavailable",
        cause,
      }),
    )
    if (!replay.ok) {
      return replay.kind === "operation_conflict"
        ? { kind: "operation_conflict" }
        : { kind: "unavailable", cause: replay.cause }
    }
    if (replay.kind === "replayed") {
      return { kind: "applied", revision: replay.revision, replayed: true }
    }

    const validation = await new ValidateOrganizationChange(this.ports).execute(change)
    if (validation.kind !== "valid") return validation

    let written: OrganizationChangeWriteResult
    try {
      written = await this.ports.writer.append(change)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (written.ok) {
      return written.revision === validation.resultingRevision
        ? { kind: "applied", revision: written.revision, replayed: written.replayed }
        : {
            kind: "unavailable",
            cause: new Error("organization writer returned an unexpected revision"),
          }
    }
    if (written.kind === "conflict") {
      return { kind: "conflict", actualRevision: written.actualRevision }
    }
    return written.kind === "operation_conflict"
      ? { kind: "operation_conflict" }
      : { kind: "unavailable", cause: written.cause }
  }
}
