# 従業員ライフサイクル履歴と人事発令の実装計画

規範性: 非規範記録。種別は実装計画 snapshot。製品要件と実装済み状態は仕様正本、コード、migration で判定する。

> 実装担当エージェント向け: `superpowers:executing-plans` を使い、この計画をチェックポイント単位で実行する。各機能では `superpowers:test-driven-development`、React 変更後は `react-doctor`、完了宣言前は `superpowers:verification-before-completion` を必ず使う。

目的: 入社、配属、兼務、異動、役職変更、上司変更、部署責任者、休職、復職、退職、再入社、訂正を有効日付きで記録し、従業員詳細、組織関係、認可、承認候補者が同じ正本を参照する状態を完成させる。

アーキテクチャ: 追記専用の人事発令と版管理付き期間事実を正本にする。申請中データは汎用申請へ結合し、最終承認票、人事事実、監査、outbox を同じ D1 batch で確定する。旧 `employees` の現在値と `org_memberships` は移行中の互換投影に限定し、検証済みデータベースでは認証、組織認可、一覧、詳細を期間事実へ切り替える。

技術スタック: TypeScript、Bun Workspaces、Hono、Cloudflare Workers、D1、Drizzle ORM、Zod、Next.js App Router、React、Tailwind CSS、shadcn、Vite Plus。

## 実行上の制約

- 作業ブランチはユーザー指定どおり `main` を使う。各チェックポイントで小さくコミットし、検証済みコミットだけを `origin/main` へ push する。
- 公開リポジトリへ実在企業名、実在製品名、個人情報、認証情報を入れない。例示メールは `you@example.com` を使う。
- API ルートは `api/src/app.ts` へ必ず登録する。CLI ルートは `cli/app/index.ts` へ必ず登録する。
- `employees.status` の既存 CHECK と既存 API 型は移行互換のため `active`、`leave`、`retired` のまま保つ。新しい導出状態には別の `LifecycleEmployeeStatus` 型を作り、`prehire` を正本照会だけで表現する。
- 人事上の日付は半開区間と会社タイムゾーンで扱う。UTC 日付やサーバーのローカル日付から会社営業日を推測しない。
- 期間事実、人事発令、監査イベントは更新または削除しない。訂正は新しい発令と新しい事実版を追加する。
- 新規書き込みと正本認可は `lifecycle_migration_state.status = 'verified'` のときだけ有効にする。未移行時は旧読み取りを維持し、新規書き込みを `503 lifecycle_migration_incomplete` で拒否する。
- 各チェックポイントは失敗するテスト、最小実装、対象テスト成功、リファクタ、コミットの順に進める。

## チェックポイント: 日付、型、権限の共通契約

対象ファイル:

- 新規: `api/src/domain/employee-lifecycle/lifecycle-types.ts`
- 新規: `api/src/domain/employee-lifecycle/lifecycle-types.test.ts`
- 新規: `api/src/lib/time/company-business-date.ts`
- 新規: `api/src/lib/time/company-business-date.test.ts`
- 変更: `api/src/env.ts`
- 変更: `api/src/interface/shared/test/create-test-context.ts`
- 変更: `api/.dev.vars.example`
- 変更: `api/src/lib/auth/permission-keys.ts`
- 変更: `api/src/lib/auth/system-roles.ts`
- 変更: `api/src/lib/auth/system-roles.test.ts`
- 変更: `api/src/lib/errors.ts`
- 変更: `api/src/interface/lib/to-http-exception.ts`

- [ ] `company-business-date.test.ts` に、`Asia/Tokyo` の日付境界、夏時間のある IANA タイムゾーン、未知のタイムゾーン、未設定値、厳格な `YYYY-MM-DD`、翌暦日計算の失敗テストを書く。
- [ ] `lifecycle-types.test.ts` に、全発令種別、`prehire` を含む導出状態、種別別 payload の未知キー拒否、退職日の翌日変換、役職変更区分必須の失敗テストを書く。
- [ ] 次の公開契約を実装する。

```ts
export const lifecycleEmployeeStatusSchema = z.enum(["prehire", "active", "leave", "retired"])

export const personnelActionKindSchema = z.enum([
  "hire",
  "rehire",
  "primary_assignment_started",
  "transferred",
  "concurrent_assignment_started",
  "assignment_ended",
  "position_changed",
  "manager_changed",
  "department_responsibility_started",
  "department_responsibility_ended",
  "leave_started",
  "returned",
  "retired",
  "corrected",
  "legacy_baseline",
])

export function resolveCompanyBusinessDate(props: {
  now: string
  timeZone: string | undefined
}): string | CompanyTimeZoneError

export function nextCalendarDate(value: string): string | InvalidBusinessDateError

export function containsBusinessDate(props: {
  startsOn: string
  endsOn: string | null
  businessDate: string
}): boolean
```

- [ ] `Bindings` に `COMPANY_TIME_ZONE` を追加し、テスト既定値と `.dev.vars.example` を `Asia/Tokyo` にする。本番では未設定を許容型に残して、実行時に fail closed で分類する。
- [ ] `ApplicationError` に設計書の安定エラーコードを追加し、`toHttpException` で入力不正を `422`、競合を `409`、移行未完了とタイムゾーン不能を `503` に固定する。
- [ ] 権限カタログへ `employee:lifecycle:request`、`employee:lifecycle:apply`、`employee:lifecycle:read:all`、`employee:archive` を追加する。manager は request、HR と admin は四権限を持つ。既存 `employee:delete` は残すが、新機能の判定には使わない。
- [ ] 対象テストを実行し、全件成功を確認する。

```text
cd api && bun test src/domain/employee-lifecycle/lifecycle-types.test.ts src/lib/time/company-business-date.test.ts src/lib/auth/system-roles.test.ts
```

- [ ] `feat(api): add lifecycle contracts and permissions` でコミットする。

## チェックポイント: 追記専用スキーマと migration

対象ファイル:

- 新規: `api/migrations/0019_employee_lifecycle.sql`
- 新規: `api/src/infrastructure/employee-lifecycle/employee-lifecycle-migration.test.ts`
- 変更: `api/src/schema.ts`
- 変更: `api/src/infrastructure/audit/audit-migration.test.ts`

- [ ] migration テストへ、fresh schema 適用、既存 schema からの upgrade、全外部キー、全 CHECK、全一意制約、全追記専用 trigger、旧テーブル保持、二重訂正拒否を先に書く。
- [ ] `0019_employee_lifecycle.sql` で次の表を追加する。

```text
personnel_actions
employment_period_versions
employee_status_period_versions
org_assignment_period_versions
org_responsibility_period_versions
employee_lifecycle_revisions
organization_lifecycle_state
personnel_action_requests
application_subjects
application_completion_bindings
lifecycle_migration_state
lifecycle_outbox
lifecycle_effect_template_bindings
```

- [ ] `employees` へ `archived_at`、`archived_by_account_id` を nullable で追加する。`org_departments` へ `archived_at`、`archived_by_account_id` を nullable で追加する。旧 Worker が新 migration 後も動くことを upgrade テストで証明する。
- [ ] `personnel_actions` へ `operation_id` の一意制約、`corrects_action_id` の一意部分 index、`source_application_id` の一意部分 indexを設ける。`summary_json`、`payload_fingerprint`、実行主体、対象、業務日、記録時点を保持する。
- [ ] 四つの期間版テーブルは `(period_id, revision)` を主キーにし、`revision > 0`、`starts_on < ends_on`、管理語彙、`is_void` の CHECK を設ける。各論理 period の最新 revision を引く index と従業員、部署、日付の検索 index を設ける。
- [ ] SQLite だけで表現できる不変条件は trigger で守る。`personnel_actions` と四つの期間版テーブルへ UPDATE と DELETE を拒否する trigger を付ける。期間重複、上司循環、将来境界の全体検証は application 層で行い、revision guard で並行書き込みを防ぐ。
- [ ] `lifecycle_migration_state` は単一行の `pending`、`backfilled`、`verified` 状態、baseline、time zone、legacy fingerprint、件数、検証日時を持つ。migration 自体は `pending` 行だけを追加し、既存値を推測して backfill しない。
- [ ] `lifecycle_outbox` は `personnel_action_id` と `effect_type` の複合一意制約、payload、attempt count、next attempt、processed at を持つ。
- [ ] `lifecycle_effect_template_bindings` は `hire` と `retired` の effect ごとに一つの `onboarding_templates.code` を参照する。hire は `kind = 'join'`、retired は `kind = 'leave'` の template だけを application 層で設定可能にする。
- [ ] `application_templates` へ nullable かつ一意な `system_binding` と、許可リストで検査する nullable な `completion_handler_key` を追加する。人事発令用 binding は管理 API から変更できない制約を route と application 層で守る。
- [ ] Drizzle 定義と `schema` export へ全表と relation を追加する。SQL 名、Drizzle 名、nullable、enum CHECK を一致させる。
- [ ] migration と全 schema 読み込みテストを実行する。

```text
cd api && bun test src/infrastructure/employee-lifecycle/employee-lifecycle-migration.test.ts src/infrastructure/audit/audit-migration.test.ts
```

- [ ] `feat(api): add lifecycle append-only schema` でコミットする。

## チェックポイント: 期間予定表と発令射影の純粋ドメイン

対象ファイル:

- 新規: `api/src/domain/employee-lifecycle/lifecycle-schedule.ts`
- 新規: `api/src/domain/employee-lifecycle/lifecycle-schedule.test.ts`
- 新規: `api/src/domain/employee-lifecycle/project-personnel-action.ts`
- 新規: `api/src/domain/employee-lifecycle/project-personnel-action.test.ts`
- 新規: `api/src/domain/employee-lifecycle/validate-lifecycle-schedule.ts`
- 新規: `api/src/domain/employee-lifecycle/validate-lifecycle-schedule.test.ts`

- [ ] 純粋関数テストへ、半開期間の境界、過去、現在、未来、入社、休職、復職、退職、再入社、主所属一件、兼務複数、同部署重複、異動と同日役職変更、役職区分、上司自己参照、二者循環、長い循環、未来循環、訂正、無効化、再訂正を書く。
- [ ] 次の型付き予定表を実装する。DB 行を直接変更するのではなく、既存最新版から正規化済みの変更後予定表と追記 mutation を返す。

```ts
export type LifecycleSchedule = {
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmployeeStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}

export type PersonnelActionProjection = {
  schedule: LifecycleSchedule
  mutations: ReadonlyArray<LifecycleVersionMutation>
  summary: PersonnelActionSummary
  affectsOrganization: boolean
}

export function projectPersonnelAction(props: {
  schedule: LifecycleSchedule
  organizationSchedules: ReadonlyArray<LifecycleSchedule>
  command: PersonnelActionCommand
}): PersonnelActionProjection | ApplicationError
```

- [ ] 雇用期間内で状態が全日一件、主所属が同日一件以下、所属と責任が雇用内、上司と責任者が対象日に在籍、部署が対象日に利用可能、全境界日で管理グラフが非循環、退職が全 open 期間を翌日で閉じることを検証する。
- [ ] `summary` は種別別 Zod schema で parse し、部署コードと当時名、役職、上司コード、状態、有効日だけを返す。氏名、メール、理由、コメント、認証情報を受け付けない。
- [ ] 訂正は元発令の mutation 群を参照し、影響期間の新 revision または void revision を作る。訂正対象に既存後継がある場合は `personnel_action_already_corrected` を返す。
- [ ] 全純粋ドメインテストを実行する。

```text
cd api && bun test src/domain/employee-lifecycle
```

- [ ] `feat(api): model effective-dated personnel actions` でコミットする。

## チェックポイント: 正本 repository と原子的な直接発令

対象ファイル:

- 新規: `api/src/infrastructure/employee-lifecycle/employee-lifecycle-repository.ts`
- 新規: `api/src/infrastructure/employee-lifecycle/personnel-action-repository.ts`
- 新規: `api/src/infrastructure/employee-lifecycle/personnel-action-repository.test.ts`
- 新規: `api/src/application/employee-lifecycle/apply-personnel-action.ts`
- 新規: `api/src/application/employee-lifecycle/apply-personnel-action.test.ts`
- 新規: `api/src/application/employee-lifecycle/correct-personnel-action.ts`
- 新規: `api/src/application/employee-lifecycle/correct-personnel-action.test.ts`
- 変更: `api/src/infrastructure/audit/audit-event-repository.ts`

- [ ] repository テストへ、最新 revision のみを読むこと、employee revision と organization revision の競合、同じ冪等キーの同一再送、同じキーの別 payload、別主体、監査失敗 rollback、別従業員の同時上司変更による循環拒否を書く。
- [ ] repository に次の契約を実装する。

```ts
export type PersonnelActionCompletionFragment = {
  statements: ReadonlyArray<D1PreparedStatement>
  classifyResult(
    results: ReadonlyArray<D1Result<unknown>>,
  ): { actionId: string; replayed: boolean } | ApplicationError
}

export class EmployeeLifecycleRepository {
  loadSchedule(employeeId: number): Promise<LifecycleSchedule | ApplicationError>
  loadOrganizationSchedules(): Promise<ReadonlyArray<LifecycleSchedule> | ApplicationError>
  loadRevisions(employeeId: number): Promise<
    | {
        employeeRevision: number
        organizationRevision: number
      }
    | ApplicationError
  >
}

export class ApplyPersonnelAction {
  run(
    command: DirectPersonnelActionCommand,
  ): Promise<{ action: PersonnelAction; replayed: boolean } | ApplicationError>

  prepareCompletion(
    command: WorkflowPersonnelActionCommand,
  ): Promise<PersonnelActionCompletionFragment | ApplicationError>
}
```

- [ ] 入力を Zod parse 後に JSON key 順を固定して SHA-256 fingerprint 化する。直接発令は `Idempotency-Key` を必須にし、申請経由は `personnel-action:<application_id>` を operation ID にする。
- [ ] D1 batch へ、発令 insert、期間版 insert、従業員 revision の compare-and-swap、必要時の組織 revision compare-and-swap、互換投影、監査 `prepareAppend`、outbox insert を含める。どの guard が失敗しても batch 全体を中止する。
- [ ] 同じ operation ID、主体、fingerprint は既存発令を返す。主体または fingerprint が違えば `idempotency_conflict` を返す。
- [ ] audit action を `employee.lifecycle.applied` と `employee.lifecycle.corrected` へ固定し、before と after を許可リストで組み立てる。
- [ ] 直接発令と訂正の repository テストを実行する。

```text
cd api && bun test src/infrastructure/employee-lifecycle src/application/employee-lifecycle/apply-personnel-action.test.ts src/application/employee-lifecycle/correct-personnel-action.test.ts
```

- [ ] `feat(api): apply personnel actions atomically` でコミットする。

## チェックポイント: 移行、検証、互換投影

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/preflight-lifecycle-migration.ts`
- 新規: `api/src/application/employee-lifecycle/backfill-lifecycle-migration.ts`
- 新規: `api/src/application/employee-lifecycle/verify-lifecycle-migration.ts`
- 新規: `api/src/application/employee-lifecycle/rebuild-lifecycle-projections.ts`
- 新規: `api/src/application/employee-lifecycle/lifecycle-migration.test.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/preflight/route.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/backfill/route.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/verify/route.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/rebuild-projections/route.ts`
- 変更: `api/src/app.ts`
- 変更: `api/seeds/employee.sql`
- 変更: `api/seeds/org.sql`
- 変更: `api/seeds/application.sql`
- 変更: `api/scripts/seed.sh`
- 変更: `api/scripts/verify-seed.ts`

- [ ] upgrade fixture を作り、曖昧な部署対応、重複主所属、壊れた上司参照、指定 baseline 不一致、途中再実行、fingerprint 変化、fresh seed verified の失敗テストを書く。
- [ ] preflight は `baseline_on` と `COMPANY_TIME_ZONE` を必須にし、legacy source の正規化 hash、従業員件数、部署件数、不整合一覧を返す。順序で曖昧さを解消しない。
- [ ] backfill は preflight と同じ baseline、time zone、fingerprint だけを受け、従業員ごとに決定的 operation ID の `legacy_baseline` 発令を作る。在籍と休職は暫定雇用、状態、主所属、兼務を作り、退職済みには雇用期間を捏造しない。
- [ ] verify は全 legacy row の対応、期間不変条件、件数、fingerprint、投影差分を検査してから単一行を `verified` にする。部分成功を verified にしない。
- [ ] projection rebuild は実行開始時の会社営業日を固定し、正本から `employees` と `org_memberships` の互換値を再構築する。差分件数を監査へ残す。
- [ ] 四ルートは admin の `batch:view` と `employee:lifecycle:apply` を両方要求し、未認証 `401`、片方不足 `403`、不整合 `409`、永続化失敗 `503` を返す。
- [ ] fresh seed は正本期間と `legacy_baseline` を投入し、migration state を `verified` にする。upgrade seed は使わない。
- [ ] API 登録漏れテストと移行テストを実行する。

```text
cd api && bun test src/application/employee-lifecycle/lifecycle-migration.test.ts src/interface/batch/employee-lifecycle
```

- [ ] `feat(api): add lifecycle migration and projection jobs` でコミットする。

## チェックポイント: 基準日状態、認証、組織認可の正本切替

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/get-lifecycle-state.ts`
- 新規: `api/src/application/employee-lifecycle/get-lifecycle-state.test.ts`
- 新規: `api/src/infrastructure/employee-lifecycle/employee-lifecycle-read-repository.ts`
- 新規: `api/src/infrastructure/employee-lifecycle/employee-lifecycle-read-repository.test.ts`
- 新規: `api/src/lib/org/lifecycle-organization-authority.ts`
- 新規: `api/src/lib/org/lifecycle-organization-authority.test.ts`
- 変更: `api/src/interface/shared/verify-bearer.ts`
- 新規: `api/src/interface/shared/verify-bearer.test.ts`
- 変更: `api/src/infrastructure/auth/account-auth-repository.ts`
- 変更: `api/src/lib/org/organization-authority.ts`
- 変更: `api/src/interface/org/tree/route.ts`
- 変更: `api/src/interface/org/departments/route.ts`
- 変更: `api/src/interface/org/departments/[code]/route.ts`
- 変更: `api/src/interface/org/departments/[code]/members/route.ts`
- 変更: `api/src/interface/org/reporting-line/[employee_code]/route.ts`
- 変更: `api/src/interface/employee/route.ts`
- 変更: `api/src/interface/employee/[code]/route.ts`
- 変更: `api/src/lib/app-schemas.ts`

- [ ] 状態導出テストへ、未来入社の `prehire`、在職、休職、退職日当日、退職翌日、再入社前後、アーカイブ、主所属、兼務、役職、上司、任意 `as_of` を書く。
- [ ] 認証テストへ、active と leave の許可、prehire、retired、archived の拒否、未来入社日の切替、退職翌日の切替、未知タイムゾーンの拒否、JWT 内の古い status を無視することを書く。
- [ ] 組織認可テストへ、直属上司、管理連鎖、部署責任者、過去の管理者拒否、現在の管理者許可、未来境界、循環時 fail closed、深さ上限、部署アーカイブを書く。
- [ ] `GetLifecycleState` は migration verified のときだけ期間事実を読み、`as_of` 省略時は会社営業日を使い、状態、主所属、兼務、employee revision、organization revision を返す。
- [ ] read repository は `findStatesAt(employeeIds, asOf)` で複数従業員の基準日状態を一回の問い合わせ集合から返し、一覧 API で従業員ごとの N+1 を作らない。
- [ ] `verifyBearer` と refresh は account live 状態と導出状態を毎回読む。`active` と `leave` だけを許可し、JWT の status、部署、role を認可根拠にしない。
- [ ] `organization-authority.ts` の外部契約は維持し、内部を基準日付き所属期間と責任期間へ切り替える。候補解決失敗は空配列ではなく `ApplicationError` として上位へ返す。
- [ ] 従業員一覧、詳細、組織図、部署メンバー、reporting line は同一の `as_of` と同一の認可 scope で正本を読む。一覧 rows と total に同じ条件を適用する。prehire と archived は全件履歴権限なしの通常一覧から除外する。
- [ ] 部署一覧と詳細の責任者も `org_responsibility_period_versions` から基準日現在を導出する。`org_departments.manager_employee_code` は互換 projection 更新以外で読まない。
- [ ] migration pending の既存データベースでは旧 read path だけを使い、正本と旧値を混ぜない。verified 後は旧値を参照しないことを spy と fixture で固定する。
- [ ] 認証、組織、一覧の対象テストを実行する。

```text
cd api && bun test src/application/employee-lifecycle/get-lifecycle-state.test.ts src/infrastructure/employee-lifecycle/employee-lifecycle-read-repository.test.ts src/interface/shared/verify-bearer.test.ts src/lib/org/lifecycle-organization-authority.test.ts src/interface/org src/interface/employee
```

- [ ] `feat(api): authorize from lifecycle facts` でコミットする。

## チェックポイント: 評価と既存業務の組織スコープ統合

対象ファイル:

- 変更: `api/src/application/review/generate-review-forms.ts`
- 変更: `api/src/application/review/generate-review-forms.test.ts`
- 変更: `api/src/application/goal/goal-crud.test.ts`
- 変更: `api/src/application/leave/decide-leave-request.test.ts`
- 変更: `api/src/interface/attendance/route.test.ts`
- 変更: `api/src/interface/auth/me/route.ts`
- 変更: `api/src/interface/auth/me/route.test.ts`
- 変更: `api/src/interface/employee/directory/route.ts`
- 新規: `api/src/interface/employee/directory/route.test.ts`
- 変更: `api/src/interface/application/applications/admin/route.ts`
- 変更: `api/src/interface/application/applications/admin/route.test.ts`
- 変更: `api/src/interface/expense/admin/route.ts`
- 変更: `api/src/interface/expense/admin/route.test.ts`
- 変更: `api/src/interface/leave/requests/admin/route.ts`
- 変更: `api/src/interface/leave/requests/admin/route.test.ts`
- 変更: `api/src/interface/shift/swap-requests/admin/route.ts`
- 変更: `api/src/interface/shift/swap-requests/admin/route.test.ts`
- 変更: `api/src/interface/thanks-points/redemptions/admin/route.ts`
- 変更: `api/src/interface/thanks-points/redemptions/admin/route.test.ts`
- 変更: `api/src/interface/thanks-points/redemptions/inbox/route.ts`
- 新規: `api/src/interface/thanks-points/redemptions/inbox/route.test.ts`

- [ ] 複数従業員の基準日状態は共通 read repository の `findStatesAt(employeeIds, asOf)` を使い、各管理一覧で従業員ごとの問い合わせを追加しない。
- [ ] 評価 form 生成は review cycle を開いた会社営業日の所属期間から subject の上司と部下を決め、生成済み reviewer ID を snapshot として固定する。生成後の異動で過去 form の reviewer を書き換えない。
- [ ] goal 評価、leave 決裁、expense 決裁、attendance 管理対象は共通 `organization-authority` の現在基準日判定を使う。元上司の拒否、現上司の許可、部署責任者の許可、システム権限だけでは scope 外を操作できないことを各回帰テストに追加する。
- [ ] `/auth/me` と employee directory は正本由来の状態、主所属、役職を返す。未来入社と archive を通常 directory から除外し、本人の leave は表示する。
- [ ] applications、expenses、leave requests、shift swaps、thanks redemptions の管理一覧で表示する現在部署を batch read model から解決する。rows と total の scope 条件は同じ基準日と同じ管理対象集合を使う。
- [ ] workflow candidate、評価 reviewer、目標 evaluator、休暇、経費、勤怠が `org_memberships` を直接参照していないことを `rg` と回帰テストで固定する。
- [ ] 対象テストを実行する。

```text
cd api && bun test src/infrastructure/employee-lifecycle/employee-lifecycle-read-repository.test.ts src/application/review/generate-review-forms.test.ts src/application/goal/goal-crud.test.ts src/application/leave/decide-leave-request.test.ts src/interface/attendance/route.test.ts src/interface/auth/me/route.test.ts src/interface/employee/directory src/interface/application/applications/admin src/interface/expense/admin src/interface/leave/requests/admin src/interface/shift/swap-requests/admin src/interface/thanks-points/redemptions
```

- [ ] `feat(api): unify organization scopes on lifecycle facts` でコミットする。

## チェックポイント: 履歴、状態、直接発令、訂正 API

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/list-lifecycle-events.ts`
- 新規: `api/src/application/employee-lifecycle/list-lifecycle-events.test.ts`
- 新規: `api/src/lib/pagination/lifecycle-cursor.ts`
- 新規: `api/src/lib/pagination/lifecycle-cursor.test.ts`
- 新規: `api/src/interface/employee/[code]/lifecycle-events/route.ts`
- 新規: `api/src/interface/employee/[code]/lifecycle-events/route.test.ts`
- 新規: `api/src/interface/employee/[code]/lifecycle-state/route.ts`
- 新規: `api/src/interface/employee/[code]/lifecycle-state/route.test.ts`
- 新規: `api/src/interface/employee/personnel-actions/route.ts`
- 新規: `api/src/interface/employee/personnel-actions/route.test.ts`
- 新規: `api/src/interface/employee/personnel-actions/[id]/correct/route.ts`
- 新規: `api/src/interface/employee/personnel-actions/[id]/correct/route.test.ts`
- 変更: `api/src/app.ts`

- [ ] 履歴 cursor テストへ、`event_on DESC, recorded_at DESC, id DESC`、安定走査位置、新規発令の非混入、from、to、limit、filter fingerprint、改変、条件変更、二百五十六文字超過を書く。
- [ ] 権限テストへ、本人、現在の直属上司、管理連鎖、部署責任者、`employee:lifecycle:read:all`、対象外利用者、存在秘匿 `404`、全件閲覧監査を書く。
- [ ] request と apply は system permission に加えて対象 scope を要求する。対象従業員では現在の管理連鎖または部署責任、入社では target department の責任、全社操作では `employee:lifecycle:read:all` を scope 根拠にする。system permission だけ、組織関係だけ、案件 task だけの各ケースを拒否する。
- [ ] `GET /employees/:code/lifecycle-events` は確定発令だけを返し、scheduled、corrected、legacy baseline の表示状態を付ける。結果本文を監査へ複製せず、対象 ID、件数、filter fingerprint を `employee.lifecycle.read` または `read_all` として記録する。
- [ ] cursor は version 付き JSON payload と HMAC-SHA-256 signature を base64url 化する。最大記録位置、最後の sort key、limit、filter fingerprint を含め、signature は定時間比較する。秘密には `JWT_SECRET` を使い、cursor 本文へ個人情報を入れない。
- [ ] `GET /employees/:code/lifecycle-state` は strict な `as_of` を受け、正本状態と revisions を返す。
- [ ] `POST /personnel-actions` は `employee:lifecycle:apply`、`Idempotency-Key`、base employee revision、必要時の organization revision を要求する。成功時 `201`、同一再送 `200`、競合 `409` を返す。
- [ ] `POST /personnel-actions/:id/correct` は訂正理由と型付き replacement payload を要求し、理由は timeline summary へ入れない。
- [ ] 権限不足の直接発令、訂正、全件履歴参照は `employee.lifecycle.denied` を best effort ではなく監査 repository の既存拒否記録経路へ残す。外部応答は `403` または存在秘匿 `404` のままにする。
- [ ] 全応答で既存 middleware の `X-Request-ID` が保持され、SQL、stack、payload、理由が error body に出ないことを route test で検査する。
- [ ] 全 route を `api/src/app.ts` に chain 登録し、`AppType` に現れることを型テストで固定する。
- [ ] 対象 route テストを実行する。

```text
cd api && bun test src/application/employee-lifecycle/list-lifecycle-events.test.ts src/lib/pagination/lifecycle-cursor.test.ts src/interface/employee/personnel-actions src/interface/employee/'[code]'/lifecycle-events src/interface/employee/'[code]'/lifecycle-state
```

- [ ] `feat(api): expose lifecycle state and actions` でコミットする。

## チェックポイント: 人事変更申請と汎用承認 completion

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/create-personnel-action-request.ts`
- 新規: `api/src/application/employee-lifecycle/create-personnel-action-request.test.ts`
- 新規: `api/src/application/employee-lifecycle/get-personnel-action-request.ts`
- 新規: `api/src/application/employee-lifecycle/withdraw-personnel-action-request.ts`
- 新規: `api/src/application/application/application-completion-registry.ts`
- 新規: `api/src/application/application/application-completion-registry.test.ts`
- 新規: `api/src/interface/employee/personnel-action-requests/route.ts`
- 新規: `api/src/interface/employee/personnel-action-requests/route.test.ts`
- 新規: `api/src/interface/employee/personnel-action-requests/[id]/route.ts`
- 新規: `api/src/interface/employee/personnel-action-requests/[id]/route.test.ts`
- 変更: `api/src/domain/application/application-workflow.ts`
- 変更: `api/src/lib/application/evaluate-workflow.ts`
- 変更: `api/src/lib/application/resolve-workflow-step-snapshot.ts`
- 変更: `api/src/application/application/submit-application.ts`
- 変更: `api/src/application/application/resubmit-application.ts`
- 変更: `api/src/application/application/decide-application.ts`
- 変更: `api/src/application/application/decide-workflow-application.ts`
- 変更: `api/src/infrastructure/application/application-workflow-repository.ts`
- 変更: `api/src/interface/application/templates/[code]/workflow/route.ts`
- 変更: `api/src/interface/application/applications/[id]/route.ts`
- 変更: `api/src/interface/application/applications/[id]/route.test.ts`
- 変更: `api/src/interface/application/applications/[id]/approve/route.test.ts`
- 変更: `api/src/app.ts`

- [ ] 申請テストへ、requester、subject、target department の分離、入社 prospective subject、対象者と申請者の候補除外、candidate 不足、取下げ、却下時に事実なし、未知 completion handler、fingerprint 不一致を書く。
- [ ] workflow テストへ、対象者の直属上司、対象者の管理連鎖、対象者部署責任者、異動先部署責任者、固定 role、固定 employee、条件分岐、定足数、委任、期限、escalation、snapshot 不変性を書く。
- [ ] workflow selector と condition context を次へ拡張する。

```ts
export type WorkflowSubject =
  | { type: "employee"; employeeId: number }
  | { type: "prospective_employee"; snapshot: ProspectiveEmployeeSnapshot }

export type WorkflowEvaluationContext = {
  requester: WorkflowApplicant
  subject: WorkflowSubject
  targetDepartmentCode: string | null
  payload: unknown
}
```

- [ ] 人事変更用 system template は入力 schema と `personnel_action` completion binding をコード側で固定する。管理者が変更できるのは表示名、説明、宣言的 workflow だけにする。任意 script、任意 JSON schema、動的 import を許可しない。
- [ ] workflow 公開時、request 作成時、次 step 開始時の三段階で参照 role、subject selector、target department selector、到達可能性、candidate 数、定足数を検査する。requester と subject を除外した結果が不足すれば `workflow_unresolvable` で止める。
- [ ] `POST /personnel-action-requests` は application、subject、request、completion binding、最初の workflow snapshot、監査を一つの D1 batch で作る。入社申請は従業員 ID を捏造しない。
- [ ] `GET /personnel-action-requests?target_employee_code=<code>&status=pending` は requester、snapshot 済み候補者、管理権限主体だけへ参加可能案件を返す。`GET` detail と `DELETE` withdraw も同じ application participant policy を使い、現在の上司になっただけの主体へ過去の申請本文を開示しない。
- [ ] request 作成と取下げを `employee.lifecycle.requested` と `employee.lifecycle.request_withdrawn` で監査し、payload と理由を監査へ複製しない。
- [ ] completion registry は固定 map で `personnel_action` だけを `ApplyPersonnelAction.prepareCompletion` へ接続する。未知 key と関連 request 不在は fail closed にする。
- [ ] 最終承認 branch の D1 batch を、最終承認票、定足数 guard、application approved 更新、workflow 完了、人事発令、期間版、revision guard、監査、outbox、request applied action 更新まで拡張する。一件でも失敗すれば最終承認票を残さない。
- [ ] 次 step がある branch は completion を実行しない。reject、return、withdraw も人事事実を作らない。
- [ ] submit、resubmit、step 開始、escalation、reject、final approve の既存通知を subject 対応の権限付き application Link に接続し、通知本文に理由と人事 payload を含めない。
- [ ] application detail 応答へ requester と subject と target department を別フィールドで返す。prospective subject は氏名を権限のある案件参加者だけへ返し、認証情報を返さない。
- [ ] 全 route を登録し、申請と completion の対象テストを実行する。

```text
cd api && bun test src/application/employee-lifecycle/create-personnel-action-request.test.ts src/application/application/application-completion-registry.test.ts src/interface/employee/personnel-action-requests src/interface/application/applications/'[id]'/approve/route.test.ts src/lib/application
```

- [ ] `feat(api): complete personnel actions through workflows` でコミットする。

## チェックポイント: 従業員登録、更新、退職者アーカイブ

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/archive-employee.ts`
- 新規: `api/src/application/employee-lifecycle/archive-employee.test.ts`
- 新規: `api/src/interface/employee/[code]/archive/route.ts`
- 新規: `api/src/interface/employee/[code]/archive/route.test.ts`
- 変更: `api/src/application/employee/register-employee.ts`
- 変更: `api/src/application/employee/employee-crud.test.ts`
- 変更: `api/src/application/employee/register-employee-live-permission.test.ts`
- 変更: `api/src/application/employee/update-employee.ts`
- 変更: `api/src/application/employee/delete-employee.ts`
- 変更: `api/src/infrastructure/iam/account-provisioner.ts`
- 変更: `api/src/interface/employee/route.ts`
- 変更: `api/src/interface/employee/[code]/route.ts`
- 変更: `api/src/app.ts`

- [ ] `POST /employees` のテストを直接 `hire` 発令、人物台帳、最初の期間、IAM provision、監査が原子的である契約へ変更する。future hire は prehire で通常認証不可、メールと password が発令 payload に残らないことを書く。
- [ ] `POST /employees` の入力を code、name、hire_on、email、password、role、任意の primary department code、position title、manager employee code にする。直接登録は `employee:create`、`employee:lifecycle:apply`、`account:manage` の全権限を要求し、legacy の status、dept name、dept ID から事実を推測しない。
- [ ] `AccountProvisioner` を既存従業員への account provision 用 prepared statements と、direct hire batch 用 statements に分ける。人物台帳だけを先に commit せず、hire 発令失敗、IAM 一意制約、監査失敗のどれでも全変更を rollback する。
- [ ] `PUT /employees/:code` は name だけを人物台帳更新対象にする。旧 dept、position、status が正本現在値と同一なら互換入力として受理し、異なれば `409 lifecycle_action_required` を返すテストを書く。
- [ ] `DELETE /employees/:code` は全ケースで物理削除せず `409 employee_archive_required` を返す。旧 cascade 削除コードを削除し、データ保持テストで申請、評価、勤怠、監査が残ることを証明する。
- [ ] `POST /employees/:code/archive` は `employee:archive` を要求し、退職済み、未来雇用なし、自分自身でない、最後の実効管理者でないことを検査する。account 停止、token version 更新、archive marker、監査を同じ batch に含める。
- [ ] archive 成功を `employee.archived` で監査し、従業員コード、変更前後の状態、account ID、token version だけを記録する。
- [ ] archive 後は認証と通常一覧から除外し、監査権限と履歴全件権限からは主体識別子と履歴を引き続き参照できる。
- [ ] 登録、更新、delete 互換、archive の対象テストを実行する。

```text
cd api && bun test src/application/employee/employee-crud.test.ts src/application/employee/register-employee-live-permission.test.ts src/application/employee-lifecycle/archive-employee.test.ts src/interface/employee
```

- [ ] `feat(api): preserve employee history on archive` でコミットする。

## チェックポイント: 部署アーカイブと lifecycle outbox

対象ファイル:

- 新規: `api/src/application/employee-lifecycle/process-lifecycle-outbox.ts`
- 新規: `api/src/application/employee-lifecycle/process-lifecycle-outbox.test.ts`
- 新規: `api/src/application/onboarding/update-lifecycle-template-binding.ts`
- 新規: `api/src/application/onboarding/update-lifecycle-template-binding.test.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/process-outbox/route.ts`
- 新規: `api/src/interface/batch/employee-lifecycle/process-outbox/route.test.ts`
- 新規: `api/src/interface/onboarding/templates/[code]/lifecycle-binding/route.ts`
- 新規: `api/src/interface/onboarding/templates/[code]/lifecycle-binding/route.test.ts`
- 変更: `api/src/application/org/delete-org-department.ts`
- 変更: `api/src/application/org/create-org-department.ts`
- 変更: `api/src/application/org/update-org-department.ts`
- 変更: `api/src/application/org/org-department-crud.test.ts`
- 変更: `api/src/infrastructure/onboarding/onboarding-assignment-repository.ts`
- 変更: `api/src/application/onboarding/get-onboarding-template.ts`
- 変更: `api/src/interface/onboarding/templates/route.ts`
- 変更: `api/src/interface/onboarding/templates/[code]/route.ts`
- 変更: `api/src/interface/onboarding/templates/templates-crud.test.ts`
- 変更: `api/src/interface/org/departments/[code]/route.ts`
- 変更: `api/src/app.ts`

- [ ] 部署削除を archive 状態遷移へ変更するテストを書く。現在または未来の所属期間、責任期間があれば拒否し、過去履歴は保持し、新規所属先候補から除外する。
- [ ] 部署作成と通常更新は code、master ID、parent、sort order だけを扱う。`manager_employee_code` の直接設定は `409 lifecycle_action_required` とし、責任者の開始と終了は personnel action だけで行う。
- [ ] outbox テストへ、hire の onboarding、retired の offboarding、該当 template なし、同じ action の再実行、処理失敗、retry、成功後再実行を書く。
- [ ] `ProcessLifecycleOutbox` は batch 件数を制限し、未処理 row を決定順で読み、effect binding が指す既存 onboarding template を割り当てる。既存 assignment repository へ冪等な prepared statement 生成を追加し、業務割当成功と outbox processed 更新を一つの D1 batch で確定する。
- [ ] `PUT /onboarding/templates/:code/lifecycle-binding` は `onboarding:manage` を要求し、join template には hire、leave template には retired だけを許可する。同じ effect の旧 binding は同じ batch で置換し、変更を監査する。
- [ ] outbox 処理失敗は人事発令を巻き戻さず、attempt count、next attempt、監査へ残す。通知本文へ理由と payload を複製しない。
- [ ] protected batch route を登録し、`batch:view` と `employee:lifecycle:apply` の双方を要求する。
- [ ] 部署 archive と outbox の対象テストを実行する。

```text
cd api && bun test src/application/org/org-department-crud.test.ts src/application/employee-lifecycle/process-lifecycle-outbox.test.ts src/application/onboarding/update-lifecycle-template-binding.test.ts src/interface/batch/employee-lifecycle/process-outbox src/interface/onboarding/templates/'[code]'/lifecycle-binding
```

- [ ] `feat(api): archive departments and process lifecycle effects` でコミットする。

## チェックポイント: CLI の全操作

対象ファイル:

- 新規: `cli/app/employee/timeline/route.ts`
- 新規: `cli/app/employee/timeline/route.test.ts`
- 新規: `cli/app/employee/state/route.ts`
- 新規: `cli/app/employee/state/route.test.ts`
- 新規: `cli/app/personnel-action/request/route.ts`
- 新規: `cli/app/personnel-action/request/route.test.ts`
- 新規: `cli/app/personnel-action/apply/route.ts`
- 新規: `cli/app/personnel-action/apply/route.test.ts`
- 新規: `cli/app/personnel-action/correct/[action_id]/route.ts`
- 新規: `cli/app/personnel-action/correct/[action_id]/route.test.ts`
- 新規: `cli/app/employee/archive/[code]/route.ts`
- 新規: `cli/app/batch/employee-lifecycle/route.ts`
- 新規: `cli/lib/input/read-json-file.ts`
- 新規: `cli/lib/input/read-json-file.test.ts`
- 新規: `cli/lib/input/read-secret-stdin.ts`
- 新規: `cli/lib/input/read-secret-stdin.test.ts`
- 変更: `cli/app/employee/register/route.ts`
- 変更: `cli/app/index.ts`
- 変更: `cli/index.ts`

- [ ] CLI route テストへ、help、必須引数、strict date、strict JSON payload、未知キー、二百五十六文字 cursor、Idempotency-Key、HTTP `403`、`404`、`409`、`422`、`503` の保持、機微 payload 非表示を書く。
- [ ] 次のコマンドを既存 Hono POST command pattern で実装し、`cli/app/index.ts` へ全 route を登録する。

```text
karte employee timeline --code <code> [--from <date>] [--to <date>] [--cursor <cursor>] [--limit <n>]
karte employee state --code <code> [--as-of <date>]
karte employee archive --code <code>
printf '<password>' | karte employee register --code <code> --name <name> --hire-on <date> --email <email> --role <role> --password-stdin [--department-code <code>] [--position-title <text>] [--manager-employee-code <code>]
karte personnel-action request --type <type> --payload <json-file>
karte personnel-action apply --type <type> --payload <json-file> --employee-revision <n> [--organization-revision <n>] --idempotency-key <uuid>
karte personnel-action correct --action-id <id> --payload <json-file> --reason <text> --idempotency-key <uuid>
karte batch employee-lifecycle preflight --baseline-on <date>
karte batch employee-lifecycle backfill --baseline-on <date>
karte batch employee-lifecycle verify --baseline-on <date>
karte batch employee-lifecycle rebuild-projections
karte batch employee-lifecycle process-outbox
```

- [ ] JSON file は size 上限を設け、UTF-8 JSON object だけを受け、schema parse 後の payload だけを API へ渡す。parse error で元 payload を stdout または stderr に出さない。
- [ ] 既存 `employee register` を direct hire 契約へ追従させ、status、dept name、dept ID、`--password` の旧引数を廃止する。password は `--password-stdin` 指定時だけ標準入力から一回読み、末尾改行を除去し、空値と size 超過を拒否する。help、error、shell history 向け出力へ反射しない。
- [ ] CLI のテストと型検査を実行する。

```text
cd cli && bun test && bun run check
```

- [ ] `feat(cli): add employee lifecycle commands` でコミットする。

## チェックポイント: Web の状態概要とタイムライン

実装前に `next-best-practices`、`vercel-react-best-practices`、`shadcn`、`web-design-guidelines` の指示を読み、既存 `components/ui` は直接編集しない。

対象ファイル:

- 新規: `web/lib/api/get-employee-lifecycle-state.ts`
- 新規: `web/lib/api/get-employee-lifecycle-state.test.ts`
- 新規: `web/lib/api/get-employee-lifecycle-events.ts`
- 新規: `web/lib/api/get-employee-lifecycle-events.test.ts`
- 新規: `web/app/(app)/employees/[code]/_components/employee-lifecycle-summary.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/employee-lifecycle-summary.test.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/employee-lifecycle-timeline.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/employee-lifecycle-timeline.test.tsx`
- 新規: `web/app/(app)/employees/[code]/_lib/format-lifecycle-event.ts`
- 新規: `web/app/(app)/employees/[code]/_lib/format-lifecycle-event.test.ts`
- 変更: `web/app/(app)/employees/[code]/page.tsx`
- 変更: `web/app/(app)/employees/[code]/_components/employee-detail.tsx`
- 変更: `web/app/(app)/employees/_components/employee-status-badge.tsx`
- 変更: `web/app/(app)/employees/_components/employee-table.tsx`

- [ ] API client contract テストへ、snake case 応答の parse、cursor、invalid cursor、存在秘匿、監査対象 GET の cache 無効化を書く。型は生成済み `AppType` から導出し、API 実行値を import しない。
- [ ] RSC で employee detail、lifecycle state、最初の timeline page を並列取得する。履歴取得の `fetch` は `cache: "no-store"` とし、Next.js の履歴 Link はすべて `prefetch={false}` にする。
- [ ] 詳細画面を現在概要、予定中の確定発令、確定タイムラインの順にする。prehire、active、leave、retired、archived を文言で区別し、色だけに依存しない。
- [ ] timeline item は業務日、種別、変更前後の部署、役職、上司、状態を表示する。未来発令を「予定」、baseline を「移行時点」、訂正対象を「訂正済み」、訂正発令を「訂正」と表示する。理由、承認コメント、メールを表示しない。
- [ ] cursor pagination は「さらに表示」で明示操作し、初回 filter と cursor を保持する。空、読み込み失敗、無効 cursor、部分的な長文をそれぞれ表示する。
- [ ] 三百二十ピクセル幅で横スクロールを出さず、長いコード、部署名、役職名を折り返す。見出し順、focus、キーボード操作、スクリーンリーダー用状態文言をテストする。
- [ ] Web 対象テストと型検査を実行する。

```text
cd web && bun run test -- app/'(app)'/employees lib/api/get-employee-lifecycle-events.test.ts && bunx tsc --noEmit
```

- [ ] `feat(web): show employee lifecycle timeline` でコミットする。

## チェックポイント: Web の申請、直接発令、訂正、アーカイブ

対象ファイル:

- 新規: `web/lib/api/create-personnel-action-request.ts`
- 新規: `web/lib/api/list-personnel-action-requests.ts`
- 新規: `web/lib/api/apply-personnel-action.ts`
- 新規: `web/lib/api/correct-personnel-action.ts`
- 新規: `web/lib/api/archive-employee.ts`
- 新規: `web/app/(app)/employees/[code]/_components/personnel-action-menu.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/personnel-action-form.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/personnel-action-form.test.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/personnel-action-preview.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/personnel-action-request-list.tsx`
- 新規: `web/app/(app)/employees/[code]/_components/employee-archive-dialog.tsx`
- 新規: `web/app/(app)/employees/[code]/actions.ts`
- 新規: `web/lib/employee/can-archive-employee.ts`
- 変更: `web/app/(app)/employees/[code]/_components/employee-detail.tsx`
- 変更: `web/app/(app)/employees/new/page.tsx`
- 変更: `web/app/(app)/employees/_components/employee-create-form.tsx`
- 変更: `web/app/(app)/employees/_components/employee-edit-form.tsx`
- 変更: `web/app/(app)/employees/actions.ts`
- 変更: `web/lib/api/create-employee.ts`
- 変更: `web/lib/employee/can-update-employee.ts`
- 変更: `web/app/(app)/applications/templates/[code]/workflow/_components/workflow-editor.tsx`
- 変更: `web/app/(app)/applications/templates/[code]/workflow/_components/workflow-editor.test.tsx`
- 変更: `web/app/(app)/applications/templates/[code]/workflow/_lib/workflow-definition.ts`
- 変更: `web/lib/api/types/application-workflow-types.ts`
- 変更: `web/app/(app)/applications/[id]/page.tsx`
- 新規: `web/app/(app)/org/departments/_components/department-responsibility-form.tsx`
- 新規: `web/app/(app)/org/departments/_components/department-responsibility-form.test.tsx`
- 変更: `web/app/(app)/org/departments/_components/org-department-create-form.tsx`
- 変更: `web/app/(app)/org/departments/_components/org-department-manager-list.tsx`
- 変更: `web/app/(app)/org/departments/actions.ts`
- 変更: `web/lib/api/create-org-department.ts`
- 変更: `web/lib/api/update-org-department.ts`
- 新規: `web/lib/api/update-lifecycle-template-binding.ts`
- 変更: `web/app/(app)/onboarding/_components/template-management.tsx`
- 変更: `web/app/(app)/onboarding/actions.ts`
- 削除: `web/app/(app)/employees/_components/employee-delete-button.tsx`
- 削除: `web/lib/api/delete-employee.ts`
- 削除: `web/lib/employee/can-delete-employee.ts`

- [ ] permission UI テストへ、request のみ、apply のみ、双方、archive、無権限、本人、manager 組織 scope 外を書く。非表示だけでなく server action が API の `403`、`404`、`409` を保持することを固定する。
- [ ] `/employees/new` は request 権限の入社申請と、`employee:create`、`employee:lifecycle:apply`、`account:manage` の全権限を持つ場合の account 付き直接入社を分ける。入社日、予定主所属、役職、上司を入力し、在籍 status を手入力させない。
- [ ] 発令種別 selector と種別別 Zod discriminated union でフォームを作る。自由入力 JSON は作らない。日付、部署、assignment、position、manager、position change category、退職日を種別に応じて表示する。
- [ ] 基準 revisions と現在状態を hidden input へ埋めず、server action 実行時に正本状態を再取得して API へ送る。ブラウザ側 preview は説明用であり、API の競合判定を上書きしない。
- [ ] request 権限では primary action を「申請する」、apply 権限では「確定する」と表示する。apply 送信前に Web Crypto で UUID を生成し、再送 state に同じ Idempotency-Key を保持する。
- [ ] 訂正は対象発令、変更内容、必須理由を確認する dialog にする。理由は client log、URL、timeline へ残さない。
- [ ] delete UI を撤去し、retired かつ将来雇用なしの場合だけ archive dialog を表示する。確認文言で履歴保持と login 停止を説明する。
- [ ] pending personnel action request は案件参加権限がある場合だけ表示し、application detail Link は `prefetch={false}` にする。
- [ ] workflow editor に subject manager、subject management chain、subject department manager、target department manager、system role、fixed employee の selector を追加する。条件、定足数、委任、期限、escalation を同じ画面で編集でき、system binding と completion handler は表示専用で変更用 input を作らない。
- [ ] application detail は「申請者」「対象者」「異動先部署」を別々に表示する。prospective subject と payload は案件参加権限がある場合だけ表示し、認証情報と申請外の履歴を表示しない。
- [ ] 部署作成と通常編集から責任者の直接入力を除去する。部署管理画面には発令種別を固定した責任者開始、終了 form を置き、request と apply の権限に応じて「申請する」「確定する」を分ける。
- [ ] onboarding template 管理画面で、join template を入社時自動割当、leave template を退職時自動割当に設定または解除できるようにする。同じ effect は一 template だけ選択でき、設定結果を再取得して表示する。
- [ ] Web 全テスト、型検査、React Doctor を実行し、重大度 error をゼロにする。

```text
cd web && bun run test && bunx tsc --noEmit
bunx react-doctor@latest web --verbose
```

- [ ] `feat(web): manage personnel actions from employee pages` でコミットする。

## チェックポイント: 型生成、文書、回帰テスト

対象ファイル:

- 変更: `.docs/capability-map.md`
- 変更: `.docs/features.md`
- 変更: `.docs/authorization-model.md`
- 変更: `.docs/sitemap.md`
- 変更: `.docs/api-schema.md`
- 変更: `.docs/glossary.md`
- 変更: `README.md`
- 変更: `api/dist/app.d.ts`

- [ ] API 型を再生成し、web と cli が source app の実行値を import せず追従することを確認する。

```text
cd api && bun run build:types
cd ../web && bunx tsc --noEmit
cd ../cli && bun run check
```

- [ ] 文書へ、システムロールは操作、組織関係は対象 scope、承認フローは順序という責務分離を反映する。ライフサイクル正本、全 route、CLI、Web sitemap、権限、移行手順、projection rebuild、archive を実装どおり記載する。
- [ ] `rg` で正本切替後の業務コードが `employees.dept_name`、`employees.position`、`employees.status`、`org_memberships` を直接認可へ使っていないことを調べる。許可する参照は migration、projection、互換 pending path、テスト fixture に限定する。
- [ ] API、Web、CLI の全テストと Vite Plus check を実行する。

```text
cd api && bun test
cd ../web && bun run test
cd ../cli && bun test
cd .. && vp check
```

- [ ] fresh database で migration、seed、login、projection rebuild を実行する。upgrade fixture で preflight、backfill、verify、projection rebuild を実行し、二回目が冪等であることを確認する。
- [ ] 固有名詞、個人情報、秘密、placeholder を検索する。`TODO`、`FIXME`、`TBD`、`not implemented`、`throw new Error` の新規混入を一件ずつ分類し、未実装を残さない。
- [ ] `docs: document employee lifecycle operations` でコミットする。

## チェックポイント: ブラウザでの権限別受け入れ確認

ブラウザ操作には `browser:control-in-app-browser`、性能確認には `web-perf`、最終確認には `superpowers:verification-before-completion` を使う。

- [ ] `bun install`、local D1 migration、seed、`.dev.vars`、portless を準備し、`https://karte.open.localhost` と `https://api.karte.open.localhost` を起動する。
- [ ] admin、人事、manager、本人、対象外利用者の fixture account を使い、メニュー表示、直 URL、API response を確認する。seed の共有 password はローカル fixture だけに使い、出力やコミットへ含めない。
- [ ] 入社、未来入社、配属、兼務、異動、役職変更、上司変更、部署責任者、休職、復職、未来退職、退職日翌日、再入社、訂正、未来発令取消、archive を実行する。
- [ ] 各操作後に従業員概要、timeline、従業員一覧、組織図、部署 members、reporting line、承認 inbox、notification が同じ事実を示すことを確認する。
- [ ] workflow builder で対象者上司、異動先部署責任者、固定 role、固定 employee、条件分岐、複数段、定足数、委任、期限、escalation を構成し、人事変更申請へ適用する。最終承認前は timeline に出ず、最終承認後だけ一件出ることを確認する。
- [ ] 申請者、対象者、対象外利用者が候補にならないこと、scope 外直 URL が `404`、権限不足 mutation が `403`、stale revision が `409`、migration pending が `503` であることを確認する。
- [ ] 三百二十、七百六十八、千四百四十ピクセルで横スクロール、折返し、focus、キーボード操作、dialog、error association、色以外の状態表現を確認し、各幅の screenshot を QA artifact として保存する。artifact はコミットしない。
- [ ] Core Web Vitals と network request を確認し、timeline Link の hover と viewport で履歴 API が呼ばれず、実際のページ表示時だけ監査対象 request が一回発生することを確認する。
- [ ] 最後に fresh な全検証を再実行し、出力を保存する。

```text
cd api && bun test
cd ../web && bun run test
cd ../cli && bun test
cd .. && bun run typecheck
vp check
git status --short
```

- [ ] 未追跡の秘密、DB、screenshot、`.dev.vars` がないことを確認し、残変更を目的別にコミットする。
- [ ] `git log --oneline origin/main..main` と `git diff --check origin/main...main` を確認し、`main` を `origin/main` へ push する。

## 完成判定

- [ ] 承認済み設計の全発令種別が API、CLI、Web から実行または申請できる。
- [ ] 任意基準日の状態、timeline、組織関係、認可、承認候補者が同じ期間事実を読む。
- [ ] 申請中案件と確定発令が分離され、最終承認と発令が原子的である。
- [ ] 直接発令、申請 completion、訂正、移行、outbox が冪等である。
- [ ] 退職、employee archive、department archive が業務履歴を物理削除しない。
- [ ] system role、organization scope、workflow task の三要素が API と UI の両方で独立して判定される。
- [ ] fresh migration と upgrade migration が成功し、旧 Worker 互換と verified 後の正本切替が証明される。
- [ ] API、Web、CLI、型、lint、React Doctor、ブラウザ権限 matrix、responsive、accessibility、performance の全確認が成功する。
- [ ] `.docs` と公開 API 型が実装と一致し、`main` と `origin/main` が同じ commit を指す。
