# Company API

`/company/v1` は、会社の同一性、人、雇用、組織、責務、Account対応、人事発令を公開するportableな正本である。保存table、Drizzle型、旧整数ID、画面名、個別Appの語彙は契約へ含めない。実装は `api/src/contexts/company` に閉じ、HTTP runtimeとの接続だけを `api/src/api` が持つ。

## 共通前提

全operationは認証済みAccountを要求する。API compositionは製品固有のpermissionを、Companyが理解する`company:read`、`company:write`、`company:admin`へ写像する。Company serviceはAccount ID、Employee ID、許可されたorganization ID、capabilityだけを受け取り、session、role、JWT、Hono middlewareを知らない。

Company dataを扱うrequestは`x-company-organization-id`を必須とする。IDは1から255文字の空白を含まないopaque文字列であり、呼び出し側は接頭辞や内部値を分解しない。Actorのorganization scopeに含まれないIDはfail closedで拒否する。

read responseは`organizationId`、`organizationRevision`、`resources`を返し、同じatomic D1 batchでrevisionとresourceを固定する。`effective_on`または互換aliasの`as_of`を一つだけ指定できる。両方を異なる値で指定したrequest、実在しない暦日、100件を超えるID、重複IDはbad requestである。

writeは次のheaderを必須とする。

- `x-company-organization-id`: 変更対象organization
- `Idempotency-Key`: commandのopaque ID
- `If-Match`: 直前に読んだorganization revision

bodyは`reason`と1件以上100件以下の`resources`を持つ。Actor Account IDと記録時刻はbodyから受け取らずserverが設定する。全resourceは同じorganizationに属し、同じcommand内で`type + id`を重複させない。

## Resource envelope

すべてのCompany resourceは次を持つ。

- `organizationId`: 所有organization
- `type`: Companyが定義する判別可能な種別
- `id`: 種別内で安定したopaque ID
- `revision`: resourceごとに1から連続するrevision
- `state`: `active`または`void`
- `effectiveFrom`、`effectiveTo`: 実在暦日の半開区間
- `attributes`: JSON object。深さ、件数、数値、必須属性をCompany Domainが検証する

resource種別は`legal-entity`、`company-profile`、`person`、`employee`、`employment`、`organization-unit`、`assignment`、`reporting-relation`、`position`、`grade`、`responsibility`、`collective-body`、`organizational-authority`、`account-employee-link`、`personnel-action`である。

JSON envelopeはCompany coreの版・期間・原子性を一つに揃えるためのものであり、任意の業務をEAVとして保存する逃げ道ではない。新しい意味、不変条件、機微情報、App固有事実は所有contextの型、validator、schemaへ追加する。

## Endpoints

- `GET /company/v1/capabilities`: API versionと実装済みCompany capability
- `GET|POST /company/v1/profile`: LegalEntityと会社profile
- `GET|POST /company/v1/people`: Person
- `GET|POST /company/v1/employees`: Employee
- `GET|POST /company/v1/employments`: Employment
- `GET /company/v1/organization-snapshots`: OrgUnit、Assignment、ReportingRelation、OrganizationalAuthority
- `POST /company/v1/organization-changes`: 組織変更を一つのcommandとして適用
- `GET|POST /company/v1/definitions`: Position、Grade、Responsibility、CollectiveBody
- `GET|POST /company/v1/account-employee-links`: System AccountとEmployeeの対応
- `GET|POST /company/v1/personnel-actions`: 人事発令

GETは`id` queryを繰り返して最大100件へ絞れる。`effective_on`を指定したreadはappend-only revisionからその日に有効な最新訂正を選び、将来発効の変更を過去へ混ぜない。`void`が発効した後はresourceを返さない。日付を省略したreadはcurrent headだけを返す。

POSTはendpointが所有するresource種別以外を拒否する。例えば`/people`からEmployeeを書いたり、`/organization-changes`からPositionを書いたりできない。

## Revision、訂正、取消

organization revisionは一つのcommandにつき必ず1増える。resource revisionも既存値の次でなければならない。staleな`If-Match`は`company_revision_conflict`、staleなresource revisionは`company_resource_conflict`として区別する。

訂正は同じresource IDへ次のrevisionを追記する。将来変更は新しい`effectiveFrom`を持つrevisionを追記する。取消は`state: void`の次revisionを、取消が発効する日付とともに追記する。既存revisionをUPDATEまたはDELETEしない。

`Idempotency-Key`はactor、expected revision、理由、全resourceを含むcanonical JSONのSHA-256 fingerprintへ結び付ける。同じkeyと同じcommandの再送は保存済みrevisionを`replayed: true`で返す。同じkeyを異なるcommandへ再利用すると`company_command_conflict`で拒否する。

resource revision、current head、command receipt、organization revisionは一つのD1 atomic batchで保存する。DB triggerもexpected revision、resource revisionの連続性、append-only、receipt不変性を再検査する。

## Error contract

errorは`application/problem+json`で、`type`、`title`、`status`、機械判定用`code`、`detail`を持つ。

- 400: organization、query、JSON、precondition headerが不正
- 401: 認証済みactorがない
- 403: organization scopeまたはCompany capabilityがない
- 409: organization revision、resource revision、idempotency keyの競合
- 422: resource、期間、属性、command invariantが不正
- 503: DB binding、snapshot、保存層が利用不能

評価不能時に旧projection、部分結果、暗黙のorganization、現在日、最上位roleへfallbackしない。

## Storage と移行

portable DDLはCompany contextの`infrastructure/schema/company.sql`を正本とし、各製品のmigrationへ同じ内容をコピーする。`company_organizations`がorganization revision、`company_resource_revisions`がappend-only履歴、`company_resource_heads`がcurrent projection、`company_command_receipts`が安全な再送を所有する。

初期化はcanonical organizationがrevision 0のときだけbaseline revision 1を作る。runtime consumerはcanonical System・CompanyまたはAPI compositionへ接続し、移行専用context、別API adapter、ownership例外を設けない。

`company-context.manifest.json`の`sourcePaths`はCompanyの全sourceを列挙し、`company-context.lock.json`はその全pathとhashを固定する。HIRACTとOpen BedrockはDomain、Application、Infrastructure、Interface、testを含むCompanyディレクトリ全体を同一内容に保ち、CIは欠落、余分なpath、内容差を拒否する。製品差はCompanyの外側にあるAPI compositionだけで吸収する。
