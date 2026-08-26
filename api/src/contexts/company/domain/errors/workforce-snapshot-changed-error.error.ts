import { DomainError } from "@/contexts/system/domain/errors"

export class WorkforceSnapshotChangedError extends DomainError {
  readonly code = "workforce_snapshot_changed"

  constructor() {
    super("company organization changed while workforce state was read")
    this.name = "WorkforceSnapshotChangedError"
  }
}
