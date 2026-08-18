export class WorkforceSnapshotChangedError extends Error {
  readonly code = "workforce_snapshot_changed"

  constructor() {
    super("company organization changed while workforce state was read")
    this.name = "WorkforceSnapshotChangedError"
  }
}
