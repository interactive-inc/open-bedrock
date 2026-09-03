---
ephemeral: true
---

# 実務運用可能性の監査（2026-07-26）

オーナーの問い「機能しないなら存在する意味がない。全機能が実務で機能するレベルになっているか」に対する調査記録。
57 ドメイン / api route 299 / web 画面 174 / cli route 442 を対象にした。

## 判定の基準

コードの綺麗さ・テスト有無・リファクタ余地は対象外。「画面や API は存在するのに業務がそこで完結しない」穴だけを扱う。

## メイン調査で確定した事実

### 健全だと確認できたもの（偽陽性として棄却したもの）

機械的検出で疑わしく見えたが、コードを読んで健全と確定したもの。同じ誤検出を繰り返さないために残す。

- **cli の登録漏れ: ゼロ**。442 route すべて `cli/app/index.ts` に import 済み。
  `kb/search/[q]` だけ未 import に見えるが、これは `@/app/kb/search/route` の re-export で、
  `/kb/search/:q` は index.ts:519 で登録済み。意図的な構成。
- **アカウント停止 (`suspended` / `locked`): 完全実装**。`lib/schemas.ts` の enum 以外に出現しないため
  dead state に見えるが、SQL 直書き（`application/employee-lifecycle/archive-employee.ts:133`）と
  `infrastructure/iam/account-repository.ts:150 setStatus` に実装がある。
  `POST /accounts/:id/status` ルート、最後の root を守る `last-root-guard.ts`、
  token_version インクリメントによる即時失効まで揃っている。
  ログイン時検証も `application/auth/refresh-access-token.ts:172` で `status !== "active"` を弾く。
  → **教訓: 状態値の grep は SQL 文字列リテラル内の `'value'` を見落とす。**
- **予算の消化額: 二重計上リスクなし**。`application/budget/budget-detail-view.ts:28` のとおり
  消化額を保存せず、承認済み経費から読み取り集計する設計。
- **認可の穴: なし**。認証ミドルウェア未適用の route は 9 件のみで、
  すべて login / refresh / logout / cli token / bootstrap という性質上正当なもの。
  `provisioning/identities` は machine API キー (`verify-provisioning-key`) で保護済み。
- **schema.ts の `$type<>` で宣言された状態値 42 個: 全て使用済み**。dead なものはなかった。
- **経費の並行制御**: `application/expense/decide-expense.ts` は条件付き UPDATE + D1 batch で
  二重承認と承認記録の欠損を防いでいる。自己承認禁止・組織スコープ外の承認禁止・permission 検査もある。

### 確定した欠落

#### 1. dead state: 到達不能な状態が UI に露出している（2 件）

どちらも「ユーザーが選べる検索条件なのに、該当レコードが永久に 0 件」になる。

- **expense / `settled`（精算済み）**
  - 宣言: `lib/schemas.ts:87`, `lib/app-schemas.ts:596`, `domain/expense/expense.entity.ts:13`,
    `application/expense/decide-expense.ts:20`
  - 書き込むコード: **存在しない**（テスト・seed を除く全出現を確認済み）
  - UI 露出: `web/app/(app)/expense/expenses/_components/expense-admin-filter-form.tsx:19`
    に `{ value: "settled", label: "精算済み" }`
  - CLI 露出: `cli/app/expense/mine/route.ts:13` が `--status settled` を受け付ける
  - 実務影響: 承認後「支払われたか」を追跡できない。経費の最終段が存在しない。
- **resignation / `completed`（完了）**
  - `domain/resignation/resignation.entity.ts` の遷移は `requested` → `accepted` / `rejected` の 3 状態のみ
    （`accept()` は :90-96、`reject()` は :99-105）。`completed` への遷移メソッドは無い。
  - UI 露出: `web/app/(app)/resignation/resignations/_components/resignation-admin-filter-form.tsx:14`
    に `{ value: "completed", label: "完了" }`
  - 実務影響: 退職手続きの完了を記録できない。

他の終端状態（certificate/`issued`、family-care/`cancelled`、redemption/`fulfilled`、
rental/`cancelled` `returned`）は実装済みで健全。

#### 1.5. 業務の入口と出口が切断されている（fatal 2 件・メインで独立検証済み）

dead state より重い型。申請・記録はできるが、その結果が台帳に反映されない。

- **退職: 受理しても在籍状態が変わらない**
  - `/resignations/:id/accept`（`interface/routes/resignations/[id]/accept/route.ts`）は
    `AdvanceResignation` を呼び、`resignations.status` を `accepted` にするだけで終わる。
  - 従業員を `retired` にする処理は別経路の人事発令
    `application/employee-lifecycle/apply-personnel-action.ts:74` にある。
  - **両者は完全に切断されている**。`apply-personnel-action.ts` に `resignation` の参照は 0 件、
    `application/resignation/*.ts` に `personnel` の参照も 0 件（grep で確認）。
  - `resignations` テーブル（schema.ts:1519-1537）に発令との紐付け列も無い。
  - 実務影響: 退職を受理した社員が在籍者一覧・人員計画の active カウントに残り続ける。
    人事が発令を別途手で打たないと退職が反映されず、しかも「受理済みだが発令漏れ」を
    データから検出する手段が無い。
- **採用: hired まで進めても従業員が作られない**
  - `domain/recruitment/recruitment-candidate.entity.ts:25-30` の `FORWARD_STAGE` で `hired: null`（終端）。
  - `recruitment_candidates` テーブル（schema.ts:2180-2187）の列は
    id / positionId / name / email / source / stage / note / createdAt。
    **`employee_id` 列が無い**。
  - 実務影響: applied→screening→interview→offer→hired まで選考を記録し終えても、
    候補者は従業員台帳に現れない。入社させるには氏名・部署を employees へ手入力し直す必要があり、
    採用実績と入社した従業員を突き合わせる紐付けが構造的に存在しない。

#### 1.7. 稟議の承認統制が機能していない（fatal・メインで独立検証済み）

経費と稟議で承認の堅さが極端に違う。同じ「お金の承認」なのに設計が揃っていない。

- 経費 `application/expense/decide-expense.ts` の検査は 3 層:
  `hasPermission("expense:approve")`（:33）、自己承認禁止（:49）、
  組織スコープ検査 = 上長チェーン / 部門長 / `org:manage`（:53-72）。
- 稟議 `application/ringi/submit-ringi.ts` の承認者検査は
  「自分以外」（:25）と「実在する従業員」（:38）**だけ**。
  承認権限の有無も組織階層も検査しない。
- 稟議 `application/ringi/decide-ringi.ts` の検査は
  「指名された承認者本人か」（:41-42）**だけ**。permission 検査も組織スコープ検査も無い。
- 実務影響: **起案者が承認者を自由に指名できる**ため、部下や同僚を承認者に選んで
  自分の稟議を通せる。金額上限も無い（下記 3）。稟議が統制として機能しない。

#### 1.8. 360 度評価の評価者が特定できる（要判断・メインで独立検証済み）

- `interface/routes/review-forms/route.ts:112` がフォームごとに `reviewer_employee_id` を返す。
- `interface/routes/review-forms/filter-forms-for-subject-viewer.ts` は
  可視性で**件数を絞るだけ**で、フィールドの伏せ字はしない
  （本人は `visibility === "disclosed"` のフォームを全フィールド取得できる）。
- 実務影響: 開示後、被評価者本人は同僚・部下の誰が何点付けたかを特定できる。
  360 度評価では率直な評価が集まらなくなる。
- ただし `.docs/features.md:183` は「確定までは本人非公開、サイクル単位で一括開示」
  までしか定めておらず、**評価者の匿名性について仕様に記述が無い**。
  実装の欠陥ではなく仕様の未決定事項として扱うのが正確。オーナーの判断が必要。

#### 1.9. 棄却した指摘（サブエージェントの過検出）

- **「評価フォームが全件 disclosed で生成される」→ 誤り**。
  `reviewForms` への insert 経路は `infrastructure/review/review-form-repository.ts:82` の 1 箇所のみで、
  `visibility: "hidden"`（:94）固定。`discloseByCycleId`（:110）は
  `review:administer` を持つ管理者の明示操作なので正当。
- **「給与改定を登録しても台帳の基本給が動かない」→ 設計通り**。
  `employees` テーブル（schema.ts:42-50）に給与列は存在しない。
  `.docs/features.md:101` が「給与改定の事実を履歴として記録、閲覧する」と明記しており、
  `.docs/index.md` の責任境界（給与計算は実行しない）とも整合する。

#### 1.6. 休暇残数を付与する手段が存在しない（最重要 fatal・メインで独立検証済み）

今回見つかった中で実務影響が最も大きい。

- `leaveBalances`（schema.ts:293）への **INSERT が製品コードに一切存在しない**。
  全参照が SELECT（`from(leaveBalances)`）か UPDATE
  （`infrastructure/leave/leave-request-repository.ts:180` の消化時 UPDATE）のみ。
- seed にも投入が無く（`infrastructure/seed/` に `leaveBalances` の記述 0 件）、
  従業員作成・入社処理でも残数行を作らない（`application/employee/`,
  `application/employee-lifecycle/` に `LeaveBalance` の参照 0 件）。
- 残数行が無い社員の休暇申請は承認時に必ず失敗する:
  `infrastructure/leave/leave-request-repository.ts:268` が `"balance_not_found"` を返し、
  `application/leave/decide-leave-request.ts:115-116` が 409 ConflictError にする。
- **テストが穴を隠している**。`interface/routes/leave/**/route.test.ts` は
  `seedD1(db, "leave_balances", [...])` でテーブルへ直接 INSERT して前提を作るため、
  テストは全て緑になるのに製品には付与手段が無い。
- 実務影響: 入社した社員は誰も休暇を取れない（申請は出せるが承認が 409 で必ず失敗）。
  年度切替の一括付与、法定付与日数の変更、特別休暇の追加付与も
  API・CLI・web のどこからも実行できず、人事は D1 へ直接 SQL を打つしかない。

#### 1.10. 証跡が宣言だけで記録されない（fatal 2 件・メインで独立検証済み）

`.docs/index.md` は「入力・依頼・外部結果・採否・照合・**証跡**を保持する」と宣言している。
この宣言に届いていない。

- **汎用申請ワークフローの監査ログが一件も記録されない**
  - `domain/audit/audit-event.ts:39-44` が申請系の監査アクションを 6 個宣言している:
    `application.workflow.updated` / `application.workflow.repaired` /
    `application.delegation.created` / `application.delegation.cancelled` /
    `application.decision.approved` / `application.decision.rejected`。
  - **6 個すべて書き込みコードが 0 件**（`audit-event.ts` 以外の出現がない。grep 済み）。
  - 監査記録の正しいパターンは `createAuditEvent`（例: `application/employee-lifecycle/apply-personnel-action.ts:250`）。
    これを呼ぶドメインは **auth / employee-lifecycle / governance / iam の 4 つだけ**で、
    `application/application/` と `lib/application/` からの呼び出しは 0 件。
  - 実務影響: 「この申請を誰がいつ承認したか」「誰が承認フロー定義を書き換えたか」
    「誰が承認権限を委任したか」を監査ログから追跡できない。
    内部監査・J-SOX 対応で申請系の証跡を出せない。
- **定期実行の仕組みが存在しない（batch）**
  - `batch_jobs`（schema.ts:999）への INSERT / UPDATE が 0 件。参照は
    `interface/routes/batch/route.ts` の読み取りのみ。
  - `scheduled` ハンドラも `api/wrangler.jsonc` の `triggers` / `crons` 設定も存在しない（grep 済み）。
  - 実務影響: 締め処理・リマインド・期限チェックといった時間駆動の事務が起動しない。
    seed を入れない本番では `/system/batches` が恒久的に空になり、
    運用担当は夜間処理の成否を確認できない。

#### 2. 勤怠に修正・締めの手段が無い

- 実装は打刻 2 操作のみ: `application/attendance/` に `clock-in.ts` と `clock-out.ts` だけ。
- API も `app.ts:581-586` の通り clock-in / clock-out / 参照 3 本のみ。修正・締め・確定のルートが無い。
- cli も `clock-in` / `clock-out` / 参照系のみ。
- 実務影響: 打刻漏れ・打刻ミスの修正が業務では必ず発生するが、訂正する手段がどこにも無い。
  月次確定（締め）も無いため、過去分を誰でも後から書き換えられる状態を防ぐ概念自体が存在しない。
- 補足: URL が単数形 `/attendance` で、AGENTS.md の「資源は複数形名詞」規約から外れている（`/expenses` は複数形）。名前空間マップの URL 節に沿って `/attendance-records` へ改名済み（打刻の状態遷移 `clock-in` / `clock-out` は配下に維持）。訂正・締めのルートが無い点は未解決のまま。

#### 3. 金額に上限バリデーションが無い（5 ルート）

`z.number().positive().int().safe()` のみで上限指定がなく、実質 9000 兆まで通る。

- `interface/routes/expenses/route.ts:19`
- `interface/routes/expenses/[id]/route.ts:109`
- `interface/routes/budgets/route.ts:102`
- `interface/routes/budgets/[id]/route.ts:58`
- `interface/routes/ringi/route.ts:19`

#### 4. 承認が単段のみ、金額閾値による多段承認が無い

- 稟議 (`application/ringi/submit-ringi.ts`) に金額閾値の分岐は無い。承認者を指定して 1 人が承認すれば確定する。
- 経費も同様に一段。
- 実務影響: 金額の大小に関わらず同じ重さの承認。高額案件の統制が効かない。

#### 5. 経費に証憑（領収書）添付が無い

- `receipt` の実装は存在しない。
- ただし seed のナレッジ記事 `infrastructure/seed/seed-knowledge-articles.ts:28` は
  "Attach receipts and submit advanced expenses through the expense request" と書いている。
  文書が存在しない機能を案内している。
- 実務影響: 承認者が金額を裏取りできない。

#### 6. UI から到達できない画面（3 件）

`href` / `router.push` を web 全体から抽出して突合した結果、リンク元が存在しない静的画面。

- `/my/survey-responses` — `organization/surveys/actions.ts` の `revalidatePath` で
  参照されるだけ（キャッシュ再検証でありリンクではない）
- `/attendance/attendances/overtime`
- `/company/departments/new` — 部署の新規作成画面

`/auth/broker/error` も未リンクだが、外部 IdP のエラー着地点なので正当。

## 欠落の構造（棚卸しで見えた型）

中核テーブルへの書き込み経路を数えると、欠落が特定の型に集中していることがわかる。
機能の入口（記録を作る）はあるが、「直す・付与する・終える」が無い。

| テーブル            | insert | update | delete | 何ができないか                                       |
| ------------------- | ------ | ------ | ------ | ---------------------------------------------------- |
| `leaveBalances`     | **0**  | 1      | 0      | 休暇残数を付与できない（消化 UPDATE だけがある）     |
| `batchJobs`         | **0**  | **0**  | **0**  | 何も書けない。画面は seed の飾り                     |
| `employeeGrades`    | 1      | **0**  | **0**  | 等級割当を貼り替え・取消できない                     |
| `attendanceRecords` | 1      | 1      | **0**  | 打刻を訂正・削除できない（update は clock-out 専用） |
| `employeeSkills`    | 1      | **0**  | 1      | スキルを更新できない（消して入れ直すしかない）       |

## 機械的検査で追加検出したマスタ欠落（メインで独立検証済み）

「テストが `seedD1` で直接 INSERT しているテーブル」と「製品コードに INSERT 経路があるか」を
突き合わせる検査を実行した（42 テーブル対象）。書き込み経路が製品に無いものが 3 件。

- `leave_balances` — 上記 1.6 の休暇残数（既知）
- **`skills`（スキルマスタ）** — 製品コードに INSERT が 0 件。
  `interface/routes/skills/` には `route.ts`（参照）、`me/route.ts`、`me/[skill_code]/route.ts` しかなく、
  マスタを追加するルートが無い。seed（`seed-career-sheets.ts`）が入れた分だけが選択肢になる。
  実務影響: 社員は自分のスキルを登録できるが、**組織で扱うスキルの種類を増やせない**。
  新しい技術・資格が出てきても台帳に追加できない。
- **`onboarding_template_tasks`（入社・退職タスクのテンプレート項目）** — 製品コードに INSERT が 0 件で、
  **seed にも投入が無い**。
  実務影響: 入社手続きのテンプレートは作れても、その中身のタスク項目を一つも追加できない。
  入社チェックリスト機能が実質空。

この検査は CI に組み込む価値がある（下記「副作用として見えた運用上の問題」参照）。

## 判定者・発行者を記録する列が無いテーブル（証跡の欠落）

- `antisocial_checks`（schema.ts:1674-1683）: `result` と `status` はあるが
  **誰がいつ判定したかの列が無い**。反社チェックという法務上の重要判定の責任者を特定できない。
- `certificate_requests`（schema.ts:1568-1577）: `status` を「発行済み」に倒せるが
  **`issued_by` / `issued_at` 相当の列が無い**。
  銀行・役所へ提出される在籍証明書を誰の承認で発行したか示せない。

どちらも監査イベントも残らない（上記 1.10）ため、他の経路でも追跡できない。

## 責任境界との関係

`.docs/index.md` は「法務・税・給与・会計・決済の最終計算や資金移動は実行しない、
入力・依頼・外部結果・採否・照合・証跡を保持する」と宣言している。
よって「振込を実行しない」「仕訳を切らない」は設計通りであり欠落ではない。

一方で上記 1・2・5 は「証跡を保持する」「採否を保持する」という自らの宣言に届いていない。
経費については、外部の経費精算 SaaS を正本にして open-karte は申請事実と承認証跡を持つ、
という `integration-model.md` の分担に沿った連携が未実装のまま、単独機能として画面に出ている状態。

## 監査の実施規模と最終集計

- サブエージェント 46 体、ツール実行 1,145 回、消費 258 万トークン、エラー 0。
- 5 領域（お金 / 時間 / 人 / 成長 / ワークフローと証跡）に分けてスクリーニング。
- 検出 44 件（fatal 14 / major 27 / minor 3）。うち fatal・major の 41 件を 1 件ずつ敵対的検証にかけた。
- 検証で棄却 2 件。残りは実コードで裏付けが取れた。
- 種別分布: missing_step 12 / no_data_out 7 / integrity_risk 6 / dead_state 6 /
  authz_gap 5 / no_evidence 4 / unreachable 3 / broken_ui 1。
  **「フローの段が欠けている」と「記録できるが取り出せない」で全体の 43%** を占める。

検証エージェントが本文で「fatal 妥当」と明記したのは 3 件:
休暇残数の付与手段不在、勤怠の訂正手段不在、社内公募の採否記録不在
（`domain/career/career-application.entity.ts:9` の status が `["applied","accepted",...]` を
宣言しつつ遷移メソッドが無い）。

## 検証を通過した major の全リスト（ドメイン別）

上記 fatal 群に加えて、以下が実コードで裏付け済み。

- **recruitment**: hired まで進めても従業員が作られない（上記 1.5）
- **employee-event**: 経営ダッシュボードの入社数・退職数が、人事発令と同期しない手書きログから集計されている
- **grade**: 等級マスタを在籍者の割当ごと無警告でハード削除でき、等級履歴が復元不能になる
- **onboarding**: タスクの担当ロール（`owner_role`）が定義と seed にあるだけで、展開も権限判定もされない
- **disciplinary-action**: 懲戒記録が web に画面ごと存在しない（対になる表彰は画面を持つ）
- **ringi**: 詳細参照 API と詳細画面が無く、承認者は一覧の1行だけを見て金額決裁する
- **rental**: 貸与品の予約申請に却下の状態が無く、断った事実を記録できない
- **partner**: 反社チェックの結果が取引先台帳に紐付いておらず、契約締結時に照会できない
- **career**: 社内公募に応募できるが採否を記録できず、募集側は応募が来たことも見られない（fatal 相当）
- **skill**: 自分の分しか引けず、スキル保有者を検索できない（要員アサイン・後任探しに使えない）
- **training**: 必須研修の未受講者を抽出できない / `failed` を書き込む経路が無い
- **certification**: 有効期限を保存しているが期限切れ・期限間近を検索できず失効を検知できない
- **oneonone**: 実施日時が登録操作の現在時刻に固定され、過去の面談を正しい日付で記録できない
- **survey**: 自分の回答を確認・修正・取り下げる画面がどこからも到達できない
- **shift**: 公開したシフト割当は変更・削除・公開取消がすべて不能 / 交代申請に却下の段が無い
- **family-care-leave**: 承認済みの産休・育休・介護休業を取消も期間変更もできない
- **leave**: 休暇日数を暦日で数えており土日・会社休日も残数から差し引かれる
- **room**: 会議室予約を一覧・検索する経路が無く、ID を知らない予約は取り出せない
- **work-style**: 期間を閉じる・訂正する手段が無く、`ends_on` と重複期間が放置される
- **business-trip**: 承認で終端し、実施完了・中止・実費報告のいずれも記録できない
- **attendance**: 残業サマリ画面がナビゲーションからもリンクからも到達不能（上記 6 と同じ）
- **decision**: supersede 済みの ADR を後から書き換えられ、版履歴も監査ログも残らない
- **application**: 承認フローの経過イベント表を書き込んでいるが、どのルートからも読み出せない
- **governance**: 規程の確認済み記録があるのに「誰が未確認か」を steward 権限で一覧できない
- **regulation**: 新版追加に起案者記録も第三者レビューも監査ログも無く、施行日の形式検証すら無い
- **notification**: 承認者に「決裁待ちが来た」通知が送られず、期限・エスカレーションが
  誰かが受信箱を開くまで作動しない

## 結論

基盤（認証・認可・並行制御・レイヤ構成）は実務水準にある。57 ドメインという機能の幅もある。
足りていないのは幅ではなく**各機能の出口**で、欠落は一貫して同じ形をしている。

> 申請・記録はできるが、その結果が台帳に届かない。作った記録を直せない。終われない。

機能を増やすより、既にあるものの出口を繋ぐ方が製品価値に直結する。

### 優先順位（メイン独立検証済みの fatal から）

1. **休暇残数の付与手段**（1.6）— 入社した社員が誰も休暇を取れない。影響範囲が全社員で最大。
   テストが緑なのに動かないため、CI では永久に検出されない。
2. **勤怠の訂正手段**（2）— 打刻漏れは必ず起きる。訂正できないと勤怠集計を給与・36 協定の
   根拠に使えない。
3. **退職・採用の台帳反映**（1.5）— 人事台帳の正確性そのものが崩れる。
   在籍者数・人員計画が実態と乖離する。
4. **稟議の承認統制**（1.7）— 起案者が承認者を自由に選べる。経費には組織スコープ検査があるので、
   同じ仕組みを流用できるはず（`resolveOrganizationAuthority`）。
5. **申請系の監査ログ**（1.10）— 監査アクション種別は既に宣言済みなので、
   `createAuditEvent` の呼び出しを足すだけで埋まる。実装コストが小さく効果が大きい。
6. **batch の定期実行**（1.10）— `scheduled` ハンドラと `wrangler.jsonc` の `crons` が無い。
   締め・リマインド・期限チェックがすべて手動起動になっている。

### 判断が必要なもの（実装ではなく仕様の決定）

- 360 度評価の評価者匿名性（1.8）— 仕様に記述が無い。開示時に評価者を伏せるかを決める必要がある。
- 経費の位置づけ — 実運用に耐えさせる（証憑添付 + settled 遷移 + 金額上限 + 多段承認）か、
  外部 SaaS 連携に振って「記録のみ」と明示し申請 UI を絞るか。
- `settled` / `completed` のような到達不能状態を、実装するのか UI から外すのか。

### 副作用として見えた運用上の問題

**テストが穴を隠している。** 休暇残数の例のように、`seedD1` でテーブルへ直接 INSERT して
前提を作るテストは、製品にその INSERT 経路が無くても緑になる。
「テストが通っている」を実務で動く根拠にできない。
テストヘルパが直接 INSERT しているテーブルを洗い出し、
製品コードに書き込み経路があるかを突き合わせる検査があると、この型の穴を機械的に防げる。
