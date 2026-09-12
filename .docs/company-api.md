# Company API

`/company` 配下のresource APIは、会社の同一性、人、雇用、組織、責務、Account対応を版付きresourceとして、人事発令を追記専用の履歴として公開する。保存table、Drizzle型、旧整数ID、画面名、個別Appの語彙は契約へ含めない。実装は `api/src/contexts/company` に閉じ、HTTP runtimeとの接続だけを `api/src/api` が持つ。

## 共通前提

全operationは認証済みAccountを要求する。API compositionは製品固有のpermissionを、Companyが理解する`company:read`、`company:write`、`company:admin`へ写像する。Company serviceはAccount ID、Employee ID、許可されたorganization ID、capabilityだけを受け取り、session、role、JWT、Hono middlewareを知らない。

resource envelopeを扱うrequestは`x-company-organization-id`を必須とする。IDは1から255文字の空白を含まないopaque文字列であり、呼び出し側は接頭辞や内部値を分解しない。Actorのorganization scopeに含まれないIDはfail closedで拒否する。

read responseは`organizationId`、`organizationRevision`、`resources`を返し、同じatomic D1 batchでrevisionとresourceを固定する。`effective_on`または互換aliasの`as_of`を一つだけ指定できる。両方を異なる値で指定したrequest、実在しない暦日、100件を超えるID、重複IDはbad requestである。100件までのID指定は日付条件と併用でき、指定したID以外のresourceは返さない。

writeは次のheaderを必須とする。

- `x-company-organization-id`: 変更対象organization
- `Idempotency-Key`: commandのopaque ID
- `If-Match`: 直前に読んだorganization revision

bodyは`reason`と1件以上100件以下の`resources`を持つ。Actor Account IDと記録時刻はbodyから受け取らずserverが設定する。記録時刻はCompanyの時計を使い、時計が未指定の場合だけサーバーの実時計を使う。不正な時計では503を返して履歴・receiptを保存せず、時計が復旧した後に同じ依頼を再試行できる。成功済みの再送は当初の記録時刻を保つ。全resourceは同じorganizationに属し、同じcommand内で`type + id`を重複させない。

## 会社の初期化

`POST /company/bootstrap`は、空の既定Companyへ確認済みの会社情報と最初の従業員を登録する。Systemの認証と`company:admin`、`organization:default`へのアクセスを要求し、従業員sessionの作成前に利用できる。`Idempotency-Key`を必須とし、初期状態と会社版は保存時にも検査する。

JSONは次の全項目を必須とする。

- `name`、`code`: 最初の従業員の氏名と従業員番号
- `organization_name`、`representative_name`: 確認した会社名と代表者名
- `initial_responsibilities`: 最初の従業員へ割り当てる`MANAGER`、`PEOPLE_OPERATIONS`の重複しない配列。割当がなければ空配列
- `hire_date`、`employment_type`: 確認した入社日と`FULL_TIME`または`PART_TIME`
- `locale`、`time_zone`、`fiscal_year_start_month`: 会社の言語、timezone、会計年度の開始月
- `reason`: 初期登録の理由

入社日は会社営業日以前を要求し、確認可能な組織履歴より前の在籍は422で拒否する。新規登録のtimezoneが実行環境の会社timezoneと一致しない場合は409で拒否する。代表者名は従業員名から補わず、Accountの管理権限から会社上の責務を推測しない。

Person・Employee・Employment・Assignment、会社profile、ルートOrgUnit、在籍・所属・明示した責務、Account対応、監査と再送結果を同じtransactionで保存する。会社profileと確認した会社名・責務は初期化日の会社営業日から有効とし、入社日にさかのぼって現在の会社情報を補わない。ルートOrgUnitの元の期間と訂正履歴を保全する。法人の法域や通貨を推測してLegalEntityを作らない。

成功は201で`account_id`、opaque文字列の`employee_id`、`organization_revision: 3`、`replayed: false`を返す。同じ主体・入力・キーの再送は現在の認証と管理資格を検査したうえで、元の結果を200と`replayed: true`で返す。同じキーの別内容、他の初期化、既存Companyへの上書きは409で拒否する。従業員・業務履歴がない初期状態に会社名・代表者名だけが設定済みの場合は、入力が既存値と一致するときだけ初期化できる。保存に失敗した場合は全Company変更を取り消し、同じ入力とキーで再試行できる。

CLIの`bootstrap`は`--company-data`で確認済みJSONファイル、`--idempotency-key`で再送用のキーを受け取り、System初期化、ログイン、Company初期化を順に行う。Companyの409を成功扱いせず、成功または一致する再送が確認できてからログイン情報を保存する。

## Resource envelope

resource APIのCompany resourceは次を持つ。

- `organizationId`: 所有organization
- `type`: Companyが定義する判別可能な種別
- `id`: 種別内で安定したopaque ID
- `revision`: resourceごとに1から連続するrevision
- `state`: `active`または`void`
- `effectiveFrom`、`effectiveTo`: 実在暦日の半開区間
- `attributes`: JSON object。深さ、件数、数値、必須属性をCompany Domainが検証する

resource種別は[CompanyResourceType](../api/src/contexts/company/domain/catalogs/company-resource-type.catalog.ts)に定義される。

JSON envelopeはCompany coreの版・期間・原子性を一つに揃えるためのものであり、任意の業務をEAVとして保存する逃げ道ではない。新しい意味、不変条件、機微情報、App固有事実は所有contextの型、validator、schemaへ追加する。

## Endpoints

- `GET /company/capabilities`: API versionと実装済みCompany capability
- `GET|POST /company/profile`: LegalEntityと会社profile
- `GET|POST /company/people`: Person
- `GET|POST /company/employees`: Employee
- `GET|POST /company/employments`: Employment
- `GET /company/organization-snapshots`: OrgUnit、Assignment、ReportingRelation、OrganizationalAuthority
- `POST /company/organization-changes`: 組織・雇用・任用・法人・拠点・勤務場所の関連変更を一つのcommandとして適用
- `GET|POST /company/definitions`: Position、Grade、Responsibility、CollectiveBody
- `GET|POST /company/account-employee-links`: System AccountとEmployeeの対応
- `GET /company/personnel-actions`: 確定した人事発令の履歴
- `POST /company/personnel-actions`: 旧台帳への書込は廃止し、権限確認後に410を返す
- `GET /company/legacy-personnel-action-records`: 種別だけを保存した旧台帳の読取
- `GET|POST /company/responsibility-resource-adoptions`: 確認した既存責務履歴の接続
- `GET /company/personnel-action-events`: 追記された人事発令の配送元

resource参照用のGETは`id` queryを繰り返して最大100件へ絞れる。`effective_on`を指定したreadはappend-only revisionからその日に有効な最新訂正を選び、将来発効の変更を過去へ混ぜない。`void`が発効した後はresourceを返さない。日付を省略したreadはcurrent headだけを返す。

`GET /company/profile`、`/company/people`、`/company/employees`、`/company/employments`、`/company/definitions`、`/company/organization-snapshots`、`/company/account-employee-links`、`/company/legacy-personnel-action-records`は`organization_revision`で会社版を固定できる。同じ会社版と有効日を各APIへ渡すことで、取得途中の更新を混ぜずに関連情報を参照できる。応答の`organizationRevision`とETagは指定版に一致する。指定版より後の遡及訂正は含めない。存在しない未来版や安全な非負整数でない値は400となり、最新版へ置き換えない。会社へのアクセス資格と読取能力がなければ、版の存在を照会せず403となる。

resource更新用のPOSTはendpointが所有するresource種別以外を拒否する。例えば`/people`からEmployeeを書いたり、`/organization-changes`からPositionを書いたりできない。

Account対応はSystem AccountとEmployeeの一対一の同一性を固定し、その対応が有効な期間を改訂する。同じresourceの相手の変更、別resourceによるAccountまたはEmployeeの重複所有、存在しないSystem Accountへの対応を拒否する。対応期間は公開Employeeの存在期間に収まる必要があり、Employee側の訂正でも参照を孤立させない。

対応を終了・取消した後も同一性の記録を削除しない。公開履歴へ接続した対応では、開始前・終了後・期間の空白を旧対応表で補わない。再開は同じresourceへ有効期間を追記する。対応の有効性と、System Accountの認証状態・Employeeの在籍資格はそれぞれ検査する。

公開履歴に未接続の既存対応は期間不明の記録として保全する。既知の過去を推測して公開履歴へ補わず、公開APIで同じAccountとEmployeeの期間を確認して接続する。新規従業員登録、外部identity登録、会社初期化は公開対応も原子的に保存する。新しい対応の開始日は確認日とEmployeeの開始日の遅い方とし、Accountの作成から過去の対応を推定しない。

## Revision、訂正、取消

organization revisionは一つのcommandにつき必ず1増える。resource revisionも既存値の次でなければならない。staleな`If-Match`は`company_revision_conflict`、staleなresource revisionは`company_resource_conflict`として区別する。

訂正は同じresource IDへ次のrevisionを追記する。将来変更は新しい`effectiveFrom`を持つrevisionを追記する。取消は`state: void`の次revisionを、取消が発効する日付とともに追記する。既存revisionをUPDATEまたはDELETEしない。

OrgUnitの`id`は期間IDで、`attributes.organizationUnitId`が改組後も変わらない組織の同一性を表す。OrgUnitのrevisionはその期間全体の訂正である。将来の改組は現在期間を閉じ、別の期間IDで登録する。日付指定の参照では各期間の最新訂正だけを評価するため、開始日を後ろへ訂正しても旧revisionの期間は復活しない。`void`はその期間全体を取り消す。

親組織・所属先・責務の対応する所属は、同じ所有者の最新の有効期間が切れ目なく続いていれば複数の期間を通して参照できる。途中の空白、取消済み期間、別の従業員や雇用の期間で参照期間を補うことはできない。既存の所属や責務を孤立させる訂正・取消もDBで拒否する。

`Idempotency-Key`はactor、expected revision、理由、全resourceを含むcanonical JSONのSHA-256 fingerprintへ結び付ける。同じkeyと同じcommandの再送は保存済みrevisionを`replayed: true`で返す。同じkeyを異なるcommandへ再利用すると`company_command_conflict`で拒否する。

組織変更でも現在のscopeと操作資格を確認した後、保存済みcommandを現在の会社版や親組織の状態より先に照合する。成功後に親組織が取り消されても、再送は保存済みの結果を返し、組織を復活させない。初回照会の後に同じcommandが確定した場合も、検査・保存の失敗を返す前に保存済み結果を再確認する。未成功のcommandには現在の組織構造と版の検査を適用する。

resource revision、current head、command receipt、organization revisionは一つのD1 atomic batchで保存する。DB triggerもexpected revision、resource revisionの連続性、append-only、receipt不変性を再検査する。

## 法人・拠点・勤務場所の参照整合性

SiteはLegalEntity、WorkplaceはSiteの有効期間内に存在しなければならない。Workplaceが`organizationUnitId`を持つ場合は、同じorganizationの安定したOrgUnitのIDを参照する。組織の期間resourceのIDは使わず、組織との関連を持たない勤務場所では未指定または`null`とする。

参照は全改訂から過去・現在・将来の有効期間を組み立てて検査する。連続する版や同じOrgUnitの連続する期間は合わせて参照できるが、途中の空白、別organizationの記録、参照先の開始前・終了後では補えない。将来取消した記録の過去も検査し、現在のheadが取消状態であることだけを理由に過去の勤務場所の訂正を拒否しない。

`POST /company/organization-changes`はLegalEntity・Site・Workplaceも受け付ける。法人・拠点・勤務場所と関連する組織を同じcommandで短縮・延長・取消できる。参照元を期間外へ残す変更は、会社版を確定するDB処理でも拒否する。失敗時は全resourceの版・head・command receiptを一緒に取り消す。拠点の運営法人を変更した場合も、変更前後それぞれの参照先と期間を検査する。

参照整合性のmigrationは、既存の期間不整合を制約の置換前に検出して停止する。履歴、rowid、記録者、理由、再送記録を保全し、参照先や有効期間を自動で推測・修正しない。

## 上長関係の参照期間

ReportingRelationの本人・上司・組織は、同じorganizationの有効期間を参照する。組織は`organizationUnitId`による安定した同一性を使い、期間resourceのIDや他のorganizationの同名IDで補わない。

上長関係の全改訂から、組織変更前後、将来の終了、取消までの有効期間を再構成する。終了済みのheadだけを見て過去の関係を検査から外さない。組織の連続した期間を合わせて参照できるが、空白、開始前、終了後を含む関係は会社版の確定時にもDBで拒否する。

`/company/organization-changes`は、不整合な組織訂正を422で拒否し、会社版、resource履歴、head、再送記録を取り消す。確認した上長関係の訂正と組織変更を同じcommandで送ることはできる。人の判断で確認した訂正だけを追記し、組織変更に合わせて上長関係の過去を自動で短縮しない。

移行時に既存の期間不整合があれば、制約の追加前に移行を停止する。正常な履歴、rowid、記録者、理由とcommandの再送結果は変更しない。在籍・所属との連動は[組織上の判断資格](company-organizational-authority.md)の制約も満たす必要がある。

## 雇用主法人の履歴

Employmentの`employerLegalEntityId`は、同じorganizationのLegalEntityを参照する。省略またはnullは雇用主の未記録を表し、既存の履歴へ法人を推測して補わない。雇用主は公開Employmentの改訂に保存し、有効日と会社版を指定して取得する。将来の変更を現在値へ先に反映しない。

在職中と休職中の雇用期間は、参照する法人の有効期間で切れ目なく覆われなければならない。法人の終了・期間短縮や雇用期間の訂正がこの条件を破る場合、会社版の確定時に変更全体を取り消す。関連する法人と雇用の変更は同一commandで確定できる。退職後の雇用記録は雇用主との対応を保持するが、法人が無期限に存続することを要求しない。

休職・復職・退職とその訂正では、既存の雇用主と将来発効する変更を保持する。再入社は別のEmploymentであり、以前の雇用主を自動で引き継がない。変更履歴の保存に失敗した場合も法人・雇用・会社版を全て取り消し、同じ依頼を再試行できる。

## 人と雇用の参照整合性

Employeeは同じorganizationのactiveなPersonを参照し、Employmentは同じorganizationのactiveなEmployeeを参照する。EmployeeのpersonId、EmploymentのemployeeIdは初回登録後に変更できず、取消時にも付け替えを拒否する。

Assignment、OfficeAssignment、OrganizationalAuthorityが持つemployeeIdとemploymentIdは、同じEmployeeの組み合わせでなければならない。ReportingRelationは本人と上司の両方を同じorganizationのactiveなEmployeeへ解決する。

activeな参照元が残るPerson、Employee、Employmentは取り消せない。従業員への参照にはAccount対応、上司関係、役職、責務、合議体への参加も含む。同一commandで参照元も取り消す場合は、参照元から順に保存する。

これらの検査は履歴のINSERT時にDB triggerで行い、違反は422のinvalid_resourceとして返す。失敗したcommandではresource、receipt、organization revisionと業務台帳の変更全体を取り消す。

公開APIから業務台帳へ接続したEmployeeは、Personの有効期間に含まれなければならない。雇用期間もEmployeeの有効期間に含まれなければならない。command確定時に全revisionから各発効区間を再構成し、参照先の空白、参照期間の短縮、同じEmployeeの雇用重複をDBで拒否する。職務・役職・責務・合議体・決裁資格の参照期間は[公開責務と期間台帳](company-organizational-authority.md#公開責務と期間台帳)に従う。すべてのresource種別の全参照期間の検査は未完成である。

EmployeeとEmploymentのIDは英数字で始まる128文字以内の英数字・ピリオド・下線・コロン・ハイフンとする。氏名は200文字、従業員番号と電話番号は64文字まで。Employmentは`FULL_TIME`または`PART_TIME`の雇用区分を必須とし、不明な区分を補完しない。一つのEmploymentに在籍の空白を挟むことはできず、再入社は別のEmploymentとして登録する。

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

初期化はcanonical organizationがrevision 0のときだけbaseline revision 1を作る。

`/company/people`、`/company/employees`、`/company/employments`の新しい登録・変更は、版付きresourceと`company_employees`、`company_employments`、在籍・状態のperiod versionを同じtransactionで保存する。雇用履歴から休職・復職・退職の半開期間を再構成し、actor、理由、commandのdigestを人事記録へ残す。再送では人事記録とperiod revisionを増やさない。

`company_workforce_resource_bindings`はorganization、resourceの版、Employeeの版を固定する。同じIDの別organizationへの流用、所有関係のない既存台帳への上書き、同期処理を通らずEmployeeの版だけが進んだ状態への更新を拒否する。

公開resourceへ接続済みのEmployeeでは、既存の人事発令による休職・復職・退職・再入社・訂正も雇用resourceへ反映する。訂正後の期間と既存の発効境界を比較し、変更点を次のresource revisionとして追記する。発令、期間、監査、公開履歴、command receiptを一つのtransactionで確定し、Employeeとresourceの版を揃える。公開writeとの同時実行では一方だけを確定する。

一つの発令が複数の発効境界を変える場合、公開側のorganization revisionも複数進む。発令の再送では公開履歴を増やさない。開始日を後ろへ訂正した場合は旧開始日の状態も訂正し、古い在籍期間を復活させない。

公開APIによる雇用改訂は`employment_revised`の人事記録とし、対象resourceとrevision、属性、理由を保持する。通常の復職登録や契約情報の改訂で、前の人事発令を訂正済みにしない。履歴のmigrationは既存の全列とrowidを保全し、追記専用の制約を復元する。

会社の初期化と新規従業員の入社発令は、Person・Employee・Employmentの初期resourceと対応関係を同じtransactionで作る。初期宣言と台帳の氏名・連絡先・雇用区分・発効日・状態・期間履歴が一致しない場合は登録全体を取り消す。初期resourceの版は1とし、登録後は公開APIと人事発令の両方から同じ履歴を更新できる。

新規Accountの作成・発行と一括登録を合成する製品向けには、同じ初期resourceを既存の登録batchへ組み込むadapterを提供する。一括登録は準備時に会社の版を一度だけ読み、各登録のcommandへ連続した版を割り当てる。別のCompany変更と競合した場合は全登録を取り消し、再試行の際に版を読み直す。

会社profileは初期化時から公開resourceを正本とする。接続前の会社名・代表者名は変更せず保全し、接続後は公開APIと既存の会社情報APIが同じ履歴を参照・変更する。初期化が作る所属は公開Assignmentと同じ期間対応を保持し、人事発令と公開APIから更新できる。初期化と公開Employeeへの新しい責務発令も、責務定義・組織scope・公開ResponsibilityAssignmentへ接続する。既存責務は[確認した責務履歴の接続](#既存責務の公開履歴への接続)で公開履歴へ接続できる。未接続の既存所属の全保存経路の統合は未完成である。Account対応は公開履歴へ接続し、同じ営業日で本人対応を参照する。

公開Employeeへの上長付き配属・上長変更はReportingRelationへ記録し、人事発令が管理する直属上長をEmployee・Employment・OrgUnit・所属種別へ対応させる。役職変更では関係を維持し、所属終了・異動・退職では対応する期間を閉じる。独立したReportingRelationの追加と編集は引き続き可能である。対応する所属範囲外の関係や所有者変更は拒否し、公開APIでの所属終了には関係の同時終了を要求する。上長本人の退職時は部下側の公開関係も終了し、再入社だけでは復活させない。組織変更APIは雇用と上長関係の同時変更を受け付ける。将来予約、訂正時の後続編集の競合、複数上長の扱いは[公開所属と期間台帳](company-organizational-authority.md#公開所属と期間台帳)に記載する。

公開resourceに未接続の既存台帳、招待からの登録、製品固有の人物情報writer、未接続の組織・所属・責務の保存先統合は未完成である。期間が不明な既存Account対応は、確認した期間を公開APIで接続する。入社・再入社の発令は`employmentType`に`FULL_TIME`または`PART_TIME`を必須とする。新規従業員登録の入力名は`employment_type`である。選択した区分を承認対象の本文、発令記録、業務台帳、公開雇用へ保存する。再入社と訂正で新しく作る契約にも明示した区分を使い、以前の契約の区分を変更しない。

既存の組織一覧・組織ツリー・組織詳細・所属者一覧・本人の所属組織と、組織の作成・更新・削除は既定organizationの台帳を扱う。必要なCompany capabilityまたは操作permissionに加え、`organization:default`へのアクセスを必須とする。別organizationの管理者は参照・変更・成功済み変更の再送を行えない。プロフィール変更も対象organizationへのアクセスを検査する。接続済みのOrgUnitは公開APIと既存APIの変更を同じtransactionで両方の履歴へ保存する。公開APIで新設した既定organizationのOrgUnitと、接続済みの親から既存APIで新設したOrgUnitも接続される。既存の未接続OrgUnitは管理者による履歴確認を必要とする。

雇用区分の欠ける新規入力は400で拒否する。区分を含まない旧提案は、本文やdigestを変更せず承認・実行を409で拒否し、新しい申請を求める。既存の発令履歴に区分がなければ不明のまま参照し、推測して書き足さない。Webの入社・再入社フォームとCLIの`employees register --employment-type`も区分の選択を必須とする。

既存業務台帳は単一Companyを所有し、organizationを分離する列を持たない。EmployeeとEmploymentの公開writeは`organization:default`に限定し、別organizationは422で拒否する。複数organizationの従業員を同じ台帳へ混在させる機能は未完成である。

業務側の在籍認可、従業員一覧、Accountに対応する承認候補は、雇用・状態・所属の最新period revisionと会社営業日から参照する。接続済みのEmployeeの氏名・従業員番号・存在も、PersonとEmployeeの有効日から解決する。退職日の翌日を期間の終了日とし、将来退職の予約時に表示用の雇用statusが変わっても発効前のアクセスは失わせない。欠落・重複・所有者不一致がある現在期間は評価不能として拒否する。業務台帳を直接読む残る経路の統合は未完成である。

人事変更申請の一覧は、対象者と申請者の氏名・従業員番号を会社営業日の公開履歴から解決する。従業員番号による検索も同じ時点を使い、将来の改名・番号変更を先取りしない。新規入社の申請で対象Employeeがまだ存在しない場合だけ、申請本文の人物情報を表示する。接続済みの人物履歴が欠ける場合は旧台帳や申請時の氏名で補わない。

Account表示名の共通参照も、会社営業日のPerson履歴を使う。将来の改名は発効日前に表示せず、同じ発効日の訂正は新しいrevisionを優先する。従業員へ接続済みのAccountで対応期間・Employee・Personが有効でなければ、保存済みのprofile表示名へ戻さない。未接続のAccountは会社profileの表示名を使う。指定したorganizationの範囲だけを参照し、複数の会社に表示名があればorganization ID順で選ぶ。参照によって人物履歴やprofileを書き換えない。

従業員名の一括参照は、従業員一覧と同じPerson・Employeeの有効日を使う。感謝メッセージの送受信者名もこの参照に従う。未接続の従業員は旧台帳の氏名を使い、接続済みの履歴欠落・開始前・期間終了は旧氏名で補わない。重複した人物対応、壊れた氏名、DB障害は部分的な結果を返さず拒否する。保存済みの感謝は氏名参照の障害でも再保存させず、氏名を空欄にして成功を返す。

共通の雇用状態参照は、雇用IDごとの最新の雇用期間と状態期間を使う。将来の退職・休職予約を現在の状態へ先に反映せず、終了済みの契約と再入社する契約を区別する。開始前、履歴欠落、期間の重複、取消済みの期間は有効な在籍として扱わない。表示用の退職日やstatusだけでは在籍を認めない。

従業員名の検索・並べ替えもPersonの有効日の氏名を使う。雇用区分は会社営業日に有効な公開Employmentの版を参照し、終了済み契約は最終在籍日の区分を使う。将来の改名・区分変更を現在の一覧や集計へ先に反映しない。接続済みの履歴欠落、取消、期間外、所有者不一致、不正な区分は旧台帳で補わず、未接続の雇用区分だけ旧台帳を使う。

[外部identity同期](external-identity-imports.md)は機械主体を認証し、新規Accountと公開Person・Employee・Employment、初期人事記録、期間履歴を同じtransactionで保存する。既存の公開Personの氏名・email更新にも接続する。初期記録には明示された発効日・区分・理由と内容digestを残す。既存データの過去の状態を現在の雇用statusから補完する処理は持たない。

参照整合性とprojectionのmigrationは既存台帳・履歴を保全する。適用前の欠損参照や不足する雇用区分の修復、既存データの削除、既存台帳とresourceの所有関係の推測は行わない。履歴確認で接続できない既存データの修復と、未対応のresource種別の移行は未完成である。

`company-context.manifest.json`の`sourcePaths`はCompanyの全sourceを列挙し、`company-context.lock.json`はその全pathとhashを固定する。本リポジトリと共有先はDomain、Application、Infrastructure、Interface、testを含むCompanyディレクトリ全体を同一内容に保ち、CIは欠落、余分なpath、内容差を拒否する。製品差はCompanyの外側にあるAPI compositionだけで吸収する。

## 組織の参照と編集

既存の組織一覧と組織詳細は、表示する組織と同じsnapshotの`organization_revision`と`as_of`を返す。組織の更新・削除は`expected_organization_revision`、`expected_as_of`と`Idempotency-Key`を必須とする。

Webの編集・削除フォームは表示時の版と営業日を保持し、CLIも確認した値を送る。参照後の組織変更や営業日の変更は409で拒否し、履歴と再送記録を保存しない。成功済みの同じ操作は、現在の権限を再検査して元の結果を返す。競合時に最新版へ自動再送しない。

## 氏名と本人連絡先の変更

従業員詳細と本人profileの参照は、表示するPersonと同じsnapshotから`profile`を返す。`employeeId`、`organizationRevision`、`personRevision`、`effectiveOn`が編集対象を固定する。`personRevision`は予約された変更を含む最新の人物版であり、表示する値は会社営業日に有効な版から読む。

`PUT /company/employee-directory/:code`は氏名変更権限を検査し、`name`、`profile`、`reason`を受け取る。`PUT /company/my-profile`は会社範囲と本人のEmployee対応を検査し、`phone`、`profile`、`reason`を受け取る。両操作とも`Idempotency-Key`を必須とする。電話番号の`null`は明示した削除である。氏名変更からemailを変えるなど、別項目の入力は拒否する。

保存は、閲覧した会社版とPerson版の両方が一致した場合だけ行う。変更理由と主体を持つ人物履歴、従業員表示、Account表示名、command receiptを同じtransactionで確定する。Webは表示時の版と操作キーをフォームへ保持し、CLIは明示した版とキーを送る。409を最新版への自動再送で隠さない。

Employeeとの同一性を持つAccountの表示名はPerson側で管理する。Accountプロフィールからの直接改名は、対応期間の終了・取消後も拒否する。改名の事前確認後に対応が追加された場合も、保存するtransaction内で検出して変更を取り消す。同じ表示名の再送は書き込みを行わない。

変更は表示時の会社営業日から有効になる。将来のPerson変更がある場合、現在の区間の値を変更し、予約された別区間の値は保全する。営業日を越えた新しい保存は409を返して再確認を求める。成功済みの同じ操作は翌日や後続変更後も元の結果を返し、過去の履歴や現在値を再更新しない。

公開Personに未接続の従業員では`profile`が`null`になる。Webの編集入口は対応確認が必要な旨を表示する。存在しない版を指定した保存も409で拒否し、従業員台帳だけを変更しない。既存データの対応関係と有効期間を確認する移行は引き続き必要である。

## 既存従業員の公開履歴への接続

`GET /company/employee-resource-adoptions?employee_id=<id>` は従業員台帳、全雇用・在籍期間revision、接続状態、照合用digest、会社版、会社営業日を返す。同じ従業員・雇用IDに公開履歴がある場合は、その全revisionと現在の公開版、対応するPersonの公開履歴も返し、digestに含める。各revisionには元の操作ID・主体・理由・記録日時を含める。既定organizationへのアクセスと `company:admin` が必要になる。

`POST /company/employee-resource-adoptions` は同じ参照の `employeeId`、`snapshotDigest`、`expectedRevision`、`observedOn` と、確認理由 `reason`、確認済みの `resources` を受け取る。`idempotency-key` headerは必須で、別内容による同じキーの使用は409になる。

resourcesには、一人のPerson、そのPersonに対応する既存IDのEmployee、保存済みの全契約と同じIDのEmploymentを指定する。それぞれのrevisionは1から連続させ、全体を100件以内とする。人物と従業員の有効期間は保存済みの雇用期間全体を覆い、現在の氏名・連絡先・従業員番号は台帳と一致する必要がある。雇用の所有者、契約名・区分、雇用期間と在籍状態の各区間を照合する。対応するAccountの会社表示名も現在の氏名と一致する必要があり、表示名の欠落・不一致は移行で上書きせず拒否する。

過去の氏名や従業員番号は管理者が確認した事実だけを入力し、現在値から推測して補完しない。期間履歴のない契約、部分接続、所有者の不一致は接続しない。既定organization以外への移行や、既存の公開Personへの自動名寄せは行わない。

公開履歴が既に存在する場合は `reuseExistingHistory: true` を明示する。確認したresourcesが保存済みの全revisionと一致し、各最終revisionが現在の公開版と一致する場合だけ接続する。既存IDを変更せず、公開履歴とその来歴も変更・再作成しない。指定がなければ従来どおり公開IDの衝突を409で拒否する。確認内容と履歴の不一致は422で拒否し、異なる従業員・雇用IDを対応付ける機能は持たない。

確認後の台帳・期間・公開履歴・会社版の変更は保存直前にも検査する。新規依頼が会社営業日を越えた場合も409になる。公開履歴の新規作成または既存履歴の接続、会社版、操作主体・理由・元のsnapshotを持つ変更不能な移行記録を一つのtransactionで保存する。元の台帳と期間履歴は変更しない。保存済みの同じ依頼は翌日以降も元の結果を返す。

CLIの `employees adoption --employee-id <id>` で照合対象を参照し、`employees adoption --data <confirmed-history.json> --idempotency-key <uuid>` で確認済みの履歴を送信できる。競合時に最新版への自動再送は行わない。

`POST /company/employee-resource-adoption-batches` は、確認済みの既存公開履歴を持つ従業員を一括接続する。共通の `expectedRevision`、`observedOn`、`reason` と、1〜250人の `employeeId`・`snapshotDigest` を持つ `employees` を受け取り、`idempotency-key` headerを要求する。対象の重複や任意の履歴・主体の入力は拒否する。各従業員には単独接続と同じ照合条件を適用し、履歴の欠落や氏名・雇用期間の不一致を補完しない。

保存済みの公開履歴に訂正が必要な場合は、その従業員に `corrections` を明示する。対象は既存のPerson・Employee・Employmentだけで、各resourceの現在の版に続く1〜20件を指定する。元の全履歴と訂正版を合わせて100件以内とし、既存版の上書き、版の欠落、新しいIDへの名寄せを拒否する。訂正後の全発効区間が人物・雇用・在籍の台帳と一致する場合だけ接続する。同じ発効日の新しい版で置き換えられた旧形式の属性も原履歴として残し、現在の期間には訂正版を使う。入社日の遡及訂正で隣接する同じ在籍状態は、一つの連続期間として照合する。過去の事実やAccount表示名を自動で補完する機能ではない。

初期取り込みの退職期間だけが1日短い場合は、`terminationBoundaryCorrection` に `employmentId` と確認した終了日 `endsOn` を指定できる。未接続でライフサイクル版が1、雇用・状態期間が初期版だけであること、台帳の退職日、既存公開履歴の終了日がすべて同じ補正を裏付ける場合に限る。終了日は退職日の翌日でなければならず、対応する公開雇用の訂正版も必須になる。元の退職日と期間版は残し、操作主体・理由・訂正元を持つ人事記録、雇用・状態の新しい期間版、ライフサイクル版を接続と同じtransactionへ追記する。変更済みの期間や根拠が不足する履歴は補正しない。

対象全員のsnapshotを保存直前に再照合し、訂正版の追記、全員の接続、会社版、認証された主体・理由・元のsnapshotを持つ各従業員の移行記録を一つのtransactionで保存する。訂正がなければ会社版を一度だけ進め、複数版の追記があれば必要な会社版と各操作記録を同じtransaction内で進める。会社の公開Account対応が未接続のまま残る場合や、一つでも保存が失敗した場合は全員分を取り消す。人数を分けて部分確定することはない。個々のsnapshotは750,000 byte以内、照合と証跡に使うデータの合計は8,000,000 byte以内とし、超過時は保存しない。

成功時は `employeeIds`、確定した `organizationRevision`、再送を表す `replayed` を返す。同じ対象集合なら順序を変えた翌日以降の再送も元の結果を返す。対象、確認値、訂正内容、理由、主体を変えた同じキーは409になり、再送にも現在の会社管理資格を要求する。CLIの `employees adoption-batch --data <confirmed-employees.json> --idempotency-key <uuid>` も同じAPIを使用する。

## 既存組織の公開履歴への接続

`GET /company/organization-resource-adoptions?organization_unit_id=<id>` は組織の同一性、保存済みの全期間revision、元の操作主体・理由・証拠・digest、接続状態、照合用digest、会社版、会社営業日を返す。既定organizationへのアクセスと `company:admin` が必要になる。

`POST /company/organization-resource-adoptions` は確認した `organizationUnitId`、`snapshotDigest`、`expectedRevision`、`observedOn`、確認理由 `reason` と `Idempotency-Key` を受け取る。親組織から順に接続し、期間IDと全revisionをそのまま公開履歴へ保存する。元の台帳・履歴は変更せず、元のsnapshotと移行主体・理由を変更不能な接続記録へ残す。一回の対象は一つの組織で、全期間revisionが1件から100件、元のsnapshotがUTF-8で750,000バイト以内でなければならない。

履歴の欠落、未完了の変更、既存の公開IDとの衝突、部分接続を拒否する。確認後の会社版・組織履歴の変更と営業日の変更は409になり、保存直前にも同じsnapshotを検査する。保存済みの同じ依頼は翌日以降も元の結果を返す。接続・公開履歴・会社版・移行記録の保存失敗では全体を取り消す。

接続後は会社版と組織操作の確定時にDBでも両方の最新期間を照合し、片側だけの更新を拒否する。将来の期間や取消済み期間は現在の組織一覧・詳細に混ぜない。既定organization以外の公開OrgUnitは単一Companyの既存台帳へ接続しない。所属・責務の統合は未完成である。

CLIは `departments adoption --organization-unit-id <id>` で確認内容を取得し、`departments adoption --data <confirmed-history.json> --idempotency-key <key>` で確認済みの依頼を送る。会社版を自動取得して変更を再送する処理は持たない。

## 会社プロフィールの確認と変更

一つのorganizationが持つ会社profileのidentityは一つとし、取消後も別identityを作らない。複数のidentityを持つ既存データは一意制約の追加時に拒否する。移行時に一方を自動選択したり削除したりしない。

`GET /company/organization-profile`は一つのorganizationへのCompany参照資格を要求し、会社営業日に有効な会社名・代表者名・言語・timezone・会計年度開始月と`version`を返す。`version`はorganization・会社版・resource identityと最新版・表示営業日・期間終端・表示元のfingerprintを含む。公開profileに接続する前の設定では、不明な言語・timezone・会計年度は`null`とする。接続後の代表者名が不明な場合も、旧情報から補わない。

`PUT /company/organization-profile`は対象organizationへのCompany書込資格、`Idempotency-Key`、表示した`version`、全項目と確認・変更理由を要求する。保存時に表示元と会社版を再検査し、公開履歴・監査・変更前情報・再送結果を同じtransactionで確定する。成功は200で`organizationRevision`と`replayed`を返す。同じ内容・主体・キーの成功済み再送は翌日や別変更後でも元の結果を返す。別内容のキー再利用、公開APIで既に使ったキー、未成功の古い表示は409で拒否する。

現在の編集は表示中の区間終端を保持し、将来予約された変更を取り消さない。公開profileに接続した後の期間の空白や取消では404となり、保全した旧会社情報へ戻らない。接続後の旧会社名・代表者名の直接更新もDBで拒否する。

`GET /company/profile`は`effective_on`または`as_of`を省略した場合、会社営業日で有効なprofileを読む。`POST /company/profile`は代表者名を含む取得結果を再入力できる。localeとtimezoneは実行環境が解釈可能な値を要求する。

保存した会社timezoneや会計年度開始月を、すべての業務計算の実行設定として利用する接続は未完成である。会社営業日の解決には引き続き環境の`COMPANY_TIME_ZONE`を使う。

## 既存の所属と上長履歴の接続

`GET /company/assignment-resource-adoptions?employee_id=...`は所属期間の全改訂、元のoperation・主体・理由・証拠、接続先、Company版と組織版を返す。既定organizationへのアクセスと`company:admin`を必要とする。

`POST /company/assignment-resource-adoptions`は`employeeId`、`snapshotDigest`、`expectedRevision`、`observedOn`、`reason`と`Idempotency-Key`を受け付ける。従業員・雇用と所属先のOrgUnitが接続済みであることを必要とし、その従業員の未接続の所属期間をまとめて接続する。対象は一件から千件、確認する履歴JSONは750,000 bytesまでとする。

元の全改訂を更新・削除せず、各期間の最新の訂正内容を公開Assignmentの初版へ保存する。取り消された期間は取消状態にし、将来予約の前後の空白を埋めない。過去の訂正前の理解を公開resourceの当時の記録と偽って再作成しない。確認した元の履歴とdigestは追記専用の移行証跡にも保持する。

上長はReportingRelationへ接続し、所属期間には上長を空にした次の版を追加する。既存の公開関係と同じ従業員・組織・期間が重なる場合、同じ上長であっても422で拒否する。接続済みの同じ雇用・組織・所属種別に将来の関係がある場合は、そのIDと発令の来歴を維持しながら未接続の過去の期間を追加する。

履歴・Company版・組織版が確認後に変わった場合は409、履歴の欠落・不整合は422、保存できない場合は503を返す。公開履歴、元の期間の次版、対応、移行証跡、監査と再送結果を同じtransactionで確定する。成功済みの同じ内容・同じキーは200、新しい移行は201を返す。再送でも権限を再検査する。

接続後の上長変更・訂正・退職は、通常の公開履歴と人事発令の保存処理を使う。移行自体も組織と所属期間の版を進めるため、移行前の版を確認した未実行の変更は再確認が必要になる。

CLIは`bedrock employees assignment-adoption --employee-id <id>`で確認し、`--data <confirmed-history.json> --idempotency-key <uuid>`で保存する。JSONにはPOSTの五項目を指定し、競合時に自動再送しない。

## 人事発令の配送元

`GET /company/personnel-action-events`は、既定organizationへのアクセスと`employee:read`を要求する。版付きresourceの一覧とは別に、確定した人事発令を追記順で返す。

`after_sequence`は前回の`next_sequence`を渡す非負整数で、既定は0である。`limit`は1から100で既定25、`recorded_since`は記録時刻の下限となるoffset付きISO日時である。空の結果では`next_sequence`を進めない。

各行はsequence、発令ID、従業員ID、種類、発効日、記録時刻、内容fingerprint、訂正元と訂正先、要約を持つ。入社・再入社・退職には`employment_effect`として`kind`、`eventOn`、`effectiveOn`を返す。退職の`effectiveOn`は最終在籍日の翌日である。訂正発令の要約には置換後の`replacementEventOn`を保持する。過去の訂正にこの日付がない場合は`employment_effect_unresolved`をtrueにし、効果をnullで返す。

この一覧は現在の雇用に対する実行許可や消費済みの記録ではない。受領先は発令の重複を排除し、訂正と現在の雇用を保存直前に再検査する。Companyの配送元Repositoryは、この照合に使う履歴snapshotと保存時のDB guardを提供する。

## 人事変更で確認した会社版

`POST /company/personnel-action-executions`と`POST /company/employee-registrations`は`expected_company_revision`、`POST /company/personnel-action-requests`は`base_company_revision`を必須とする。従業員・組織のライフサイクル版とは別に、入力を確認したCompanyの版を送る。保存直前に会社版が変わっていれば409で拒否し、最新版への自動置換は行わない。

役職コードは、指定した会社版と発令の有効日におけるCompanyのPositionから解決する。訂正では置換後の発令の有効日を使う。旧役職台帳や現在の名称へのフォールバックは行わず、該当なし・複数該当・存在しない会社版は拒否する。

解決した役職のresource ID・resource revision・コード・会社版・有効日を`positionReference`として発令内容に保持する。同じ名称でも別の役職は異なる内容として扱う。承認申請はこの内容と確認した会社版を保存し、実行時に参照の整合性と会社版を再検査する。承認後の競合では既存の判断証跡を残し、発令と実行許可の消費を確定しない。

同じ依頼の再送は確認した会社版も含めて照合する。過去の記録に会社版や役職参照が残っていない場合は、現在の情報から補完しない。

## 退職と組織責務

人事発令の変更と申請の実行準備は、対象雇用の全種類の組織責務を読む。部署責任者の終了は`MANAGER`だけを対象とし、同じ部署の`PEOPLE_OPERATIONS`などの別の責務は保持する。

退職は最終在籍日の翌日に対象雇用の責務を閉じ、その日以降に始まる任用予約を取消状態の次版として保存する。別の雇用や既に終了した期間には適用しない。取消した予約も訂正元の履歴に含め、退職日の訂正では確認された種類と期間を復元する。

訂正は元の発令を戻す変更と置換後の変更を区別し、同じtransactionの中で参照先の期間を開いてから参照元を開き、参照元を閉じてから参照先を閉じる。後続の発令で変わった期間を古い訂正で上書きしない。保存が失敗した場合は人事発令、期間、公開履歴、監査を一緒に巻き戻す。

公開OfficeAssignmentとOrganizationalAuthorityは、任用時のEmployeeとEmploymentに結び付く。人事発令による雇用終了では両者を終了し、所属終了では対応するOrganizationalAuthorityを終了する。OfficeAssignmentを所属終了だけで終了させない。退職日の訂正は元の履歴から必要な期間を復元し、再入社だけでは旧雇用の資格を復活させない。後続の公開編集がある任用の訂正は競合として拒否する。

公開APIから雇用や所属を短縮する場合も、有効な任用・決裁資格を期間外へ残す変更を拒否する。将来の取消予約がある記録も、それ以前の有効期間を検査する。雇用・所属・任用の終了と期間延長は同じ組織変更で確定できる。開始した組織変更が完了していなければ、期間が整合していても公開commandを確定しない。保存失敗・同時更新では履歴、期間台帳、人事記録、再送記録を一緒に取り消す。未接続の責務や上長関係の期間を推測で変更しない。人事発令の退職でもこれらを同じtransactionで確定する。

OrganizationalOfficeと組織対象のAuthorityScopeは、組織の期間resourceのIDではなく安定したOrgUnitのIDを参照する。連続した組織期間を許可し、参照中の期間の欠落・短縮を拒否する。参照整合性のmigrationは既存の不整合を検出した場合に停止し、履歴を削除・補完しない。

個人を保持者とするResponsibilityAssignmentとCollectiveBodyMembershipも、退職に合わせて有効期間を閉じる。過去の責務と参加記録、別の人の割当、役職や合議体を保持者とする責務規程を保全する。退職日の訂正は元の有効期間を新しい退職日まで復元し、後続の手動編集がある場合は409で拒否する。再入社だけでは以前の責務・構成員資格を復活させず、再任用を明示する。

個人責務と構成員の全有効期間は、そのEmployeeの連続した雇用期間に含まれなければならない。公開APIの雇用短縮、将来取消、同時変更でもDBで検査し、非在籍の空白をまたぐ割当を拒否する。既存の期間外の割当を検出したmigrationは、制約の置換前に停止して記録を保全する。

汎用のResponsibilityAssignment、OrganizationalOfficeの定義、合議体へ従来の任用を対応付ける処理は、未接続の履歴を自動推定しない。

## 既存責務の公開履歴への接続

`GET /company/responsibility-resource-adoptions?employee_id=<id>`は、既定Companyの管理者に、対象従業員の責務の全改訂、変更主体、理由、証拠、接続状況と`expectedRevision`・`snapshotDigest`・`observedOn`を返す。取消と過去の訂正も確認対象に含める。

`POST /company/responsibility-resource-adoptions`は`Idempotency-Key`と、確認した`employeeId`・`expectedRevision`・`snapshotDigest`・`observedOn`・`reason`・`mappings`を受け付ける。`mappings`は未接続の各期間の`periodId`と、接続先の`responsibilityId`・`authorityScopeId`を明示する。未接続の全期間を重複なく指定し、件数は一回につき一件から千件とする。Employee・Employment・OrgUnitの公開対応と、責務code・対象OrgUnitが一致する公開定義を必要とする。

現在有効な訂正内容からResponsibilityAssignmentを作り、元の期間ID・全改訂・記録者・記録時刻を保全する。接続の事実は期間の次版として追記し、確認した全履歴と定義の対応を変更不能な証跡へ保存する。新しい公開割当は委任不可で作る。公開責務、期間対応、組織操作、会社版、変更主体・理由、移行証跡は一つのtransactionで確定する。百件を超える公開変更も途中結果を確定しない。

不足する履歴、所有者の不一致、定義の期間外、任用期間の重複は422で拒否する。確認後の変更、確認営業日の違い、同じキーの別内容は409になる。同じ主体・内容・キーの再送は現在の管理資格を検査し、元の結果を返す。参照・保存の障害は503とし、部分的な移行結果を返さない。

CLIの`employees responsibility-adoption`も同じ確認・保存APIを使う。`--employee-id`は確認内容の参照、`--data`と`--idempotency-key`は確認済みJSONの送信を表す。競合時に会社版や確認内容を自動更新して再送しない。独立して登録された公開ResponsibilityAssignmentへの統合は行わず、接続先の一致を推測しない。

## 人事発令の公開履歴

`GET /company/personnel-actions`は、既定organizationへのアクセスと`employee:read`を要求し、確定した入社・異動・退職・訂正・初期状態・雇用改訂を記録の新しい順に返す。会社台帳の`company:read`だけでは閲覧できない。会社管理者はCompanyの共通権限規則に従う。

`employee_id`、発令`id`、発効日の`from`・`to`（訂正記録では訂正日）で絞り込み、`limit`は1から100、既定25とする。`next_cursor`を`cursor`に渡して続きへ進む。カーソルは初回の追記範囲と検索条件を固定し、条件を変えた再利用は400で拒否する。閲覧開始後の新しい発令と訂正は、最新の履歴を取得し直すと表示する。期間の両端は含む。

各記録には対象Employee ID、発令種別、発効日、記録日時、記録者Account ID、申請者Employee ID、発生元、申請ID、訂正元と訂正先、型付き要約がある。`current_employee`の氏名・コードは現在の会社台帳から取得し、発令当時の氏名を推測しない。該当する現在の台帳がない場合も、発令と対象IDを保持する。履歴の応答はキャッシュしない。

種別だけを保存する旧台帳は実際の人事発令へ変換しない。既存の版と有効期間は`GET /company/legacy-personnel-action-records`で従来のorganization指定と台帳読取権限により参照できる。`POST /company/personnel-actions`は書込権限を確認したうえで410を返し、実行APIと旧記録の参照先を示す。DBも旧台帳への新しいrevisionを拒否する。実際の発令は`POST /company/personnel-action-executions`または承認申請の既存契約で確定する。

## 組織編集時の確認条件

`GET /company/organization-units` と個別取得は、表示内容と同じsnapshotの `organization_revision` と会社営業日 `as_of` を返す。更新・削除は、その値を `expected_organization_revision` と `expected_as_of` としてJSON本文へ指定し、`Idempotency-Key` を必須とする。

確認後に組織の版または会社営業日が変わった未成功の依頼は409で拒否し、履歴と操作記録を増やさない。未来の組織期間が日付の切り替わりで有効になる場合も、最新内容の再確認を必要とする。保存直前の競合は既存のDB版制約でも検査する。

成功済みの同一依頼は、現在の会社範囲と変更権限を再検査して保存済みの結果を返す。同じキーで確認した版・日付や変更内容を変えた依頼は拒否する。確認条件を省略する旧形式の更新・削除は400となり、新しい変更を実行しない。

Webは表示内容と確認条件を同じ組織行に保持し、再読み込みで版が変わると開いている編集・削除ダイアログも更新する。CLIは `departments show` で確認した値を `--organization-revision` と `--as-of` に指定する。送信時に最新版を自動取得して入力内容と組み合わせない。

## 等級と雇用への割当

公開GradeとPositionは、code・officialNameに加え、rankとdescriptionを保持できる。rankは整数またはnull、descriptionは文字列またはnullであり、省略された値を推測で補わない。各変更はresourceの新しい版として記録し、将来の変更で過去の名称・並び順・説明を書き換えない。

`POST /company/organization-changes`はGradeとGradeAssignmentを同じ会社版で作成・訂正・取消できる。GradeAssignmentのattributesはemployeeId・employmentId・gradeIdを必須とする。`GET /company/organization-snapshots`は指定した有効日の等級割当も返す。

等級割当の有効期間は、同じ会社のEmployee、本人が所有するEmployment、Gradeの有効期間で覆われなければならない。一つの雇用への複数の割当が重なる変更と、同じ割当IDを別の従業員・雇用へ付け替える変更を拒否する。期間の終了と後続割当の開始が同日であれば重複としない。将来の定義変更や取消も含め、会社版の確定時にDBで検査する。

一つの人事発令で同じ資源に複数の版を追加する場合も、会社版は一度だけ進む。途中の取消・訂正状態を別の会社版として確定しない。通常の公開commandでは同じ資源の重複入力を拒否し、発令内部の履歴batchだけが連続した資源版をまとめて保存する。

退職発令は同じtransactionで雇用に結び付く等級割当を終了する。退職日の訂正は元の割当と後続変更を検査し、再入社では以前の雇用に結び付く等級を復活させない。保存失敗は会社版、履歴、発令、再送記録とともに取り消す。

従来の等級・役職定義は、`GET /company/definition-resource-adoptions`で種類と旧IDを指定して確認し、`POST /company/definition-resource-adoptions`で公開履歴へ接続できる。確認した会社版・snapshot digest・確認日・公開ID・理由と再送キーが必要で、既定の会社範囲とCompany管理資格を再送時にも検査する。現在の定義を旧作成日へ遡及せず、確認日から有効にする。職務との対応が不明な旧役職にjobを推測で割り当てない。

接続は元のcode・name・rank・description・createdAtを証跡として公開履歴と同じtransactionへ保存する。確認後の変更、同じ旧定義への競合、既存の公開ID・codeとの衝突は拒否する。接続済みの旧定義への上書き・削除・置換をDBが拒否し、元の記録を上書きして証跡を変えさせない。

`GET /company/definition-resource-adoptions/:commandId`は確認主体・理由・会社版・確認日・記録時点と元の定義を返す。旧定義テーブルの撤去後も、この証跡と成功済みの再送結果は残る。証跡の更新と削除は拒否する。

旧等級付与の保全原記録では、付与ID・定義ID・確認時の順位がJavaScriptの安全な整数範囲内ならJSON数値、範囲外なら正確な十進文字列になる。SQLiteの符号付き64ビット整数を丸めず保持し、既に保存したJSON原文と照合digestは書き換えない。保全後は元の等級テーブルを参照せずに原記録を取得・再送できる。

旧等級・役職定義と旧等級付与のAPIは原記録の読み取りだけを提供し、登録・上書き・削除は提供しない。新しい定義は`/company/definitions`、等級割当は`/company/organization-changes`で会社版・理由・有効期間を伴う履歴として保存する。

旧人事注記は`GET /company/personnel-annotations`で参照する。`employee_code`または原記録の`employee_id`の一方を指定し、本人または`employee:read`を持つ主体が既定会社の範囲で読む。対象が現在の従業員台帳に存在しなくても、対象IDと閲覧権限から原記録を参照できる。`kind`は元の文字列で絞り込める。

元のIDは整数精度を失わない十進文字列で返す。適用日・記録日・部署コード・備考と対象IDは原文を保持し、空文字、未知の種別、不明な日付を補正しない。元のテーブルを注記の保存先へ改名して全列を保全し、更新・削除をDBで拒否する。注記を確定した雇用・所属変更へ推測変換しない。旧`/company/employee-events`と注記への書き込みAPIは提供しない。新しい人事変更は人事発令または承認申請を経由する。

従業員等級の旧台帳の移行と旧定義の読み取り経路の撤去は未完了である。書き込み経路の撤去だけで全台帳が統一されたとは扱わない。元の記録を保全する前に旧台帳を削除しない。

## 等級・役職CLIの公開履歴

`grade-definitions`と`position-definitions`のlist・create・update・deleteは、`/company/definitions`だけを使用する。listはorganization-idを必須とし、会社版・資源版・有効期間を返す。as-ofを指定した場合はその日の有効な定義を取得し、省略した場合は将来予約を含む最新の資源版を取得する。

保存にはdataで指定したJSONとidempotency-keyが必要である。JSONはorganizationId・expectedRevision・reason・resourcesを持ち、各資源には同じ会社ID、公開ID、種類、版、状態、有効期間、属性を含める。createはactiveの初版、updateはactiveの後続版、deleteはvoidの後続版を一つの公開commandで保存する。取消も履歴を残す。

CLIは保存直前に最新版を取得して確認条件を置き換えず、指定された会社版・資源版・再送キーを保持する。競合を自動で上書き・再試行しない。旧形式の数値IDやcode・name・rankだけを指定する保存は拒否する。

## 定義管理の限定権限

`master:grade:write`は等級定義、`master:position:write`は役職定義の登録・訂正・取消を許可する。限定権限による`GET /company/definitions`には対応する`type=grade`または`type=position`が必要で、他の種類や種類未指定の一覧は許可しない。IDの指定だけでは種類の制限を代替できない。

変更対象の全種類について資格を検査し、許可されていない種類を含む一括変更は全体を拒否する。会社範囲と現在の資格は再送時にも検査する。この限定権限だけでは人物情報の参照、人事上の等級割当、業務上の承認資格を得られない。

## 定義の会社版指定

`GET /company/definitions`のorganization_revisionは、参照する会社版を固定する。effective_onと併用すると、その会社版に記録されていた指定日の定義を返す。後日の改名、遡及訂正、取消を過去の会社版へ混入させない。日付未指定では、指定会社版までに記録された各資源の最終版を返す。

応答のorganizationRevisionとETagは指定した会社版になる。負数、小数、存在しない将来の会社版は400で拒否し、現在の会社版へ置き換えない。会社範囲と閲覧資格の検査は過去の会社版でも必要である。会社版指定を省略した場合は現在の会社版を使う。

等級・役職CLIのlistはorganization-revisionで同じ指定を渡せる。この指定は読み取りの条件であり、保存時のexpectedRevisionを書き換えない。

## 入退社の集計

経営集計は、在籍snapshotと同じ会社版までの公開Employment履歴を参照する。退職日は半開期間の終了境界の前日とする。会社営業日の30日前から当日までを両端込みで対象とし、将来の開始・終了を含めない。同じ従業員の連続した雇用期間を一つの在籍として数え、契約の重複・更新、休職・復職を入退社として加算しない。空白期間を挟む再入社は別の在籍開始になる。

同じ発効日の訂正と取消を反映し、指定した会社版より後の変更は集計へ混ぜない。旧人事注記から入退社の事実を推測しない。既存契約に公開雇用履歴への未接続がある場合や履歴を復元できない場合は集計に失敗し、部分的な件数やゼロ件を返さない。未接続の契約は、確認済みの期間と出所を保全して公開履歴へ接続する必要がある。

## 会社の変更取得

GET /company/changesは、指定会社の公開資源履歴に保存された変更を会社版、資源種別、資源ID、資源改訂番号の順で返す。x-company-organization-idで会社を指定し、その会社へのアクセス範囲とcompany:read能力を要求する。等級・役職だけの管理権限では参照できない。

応答には資源の識別子と改訂番号、会社版、command ID、状態、有効期間、記録時点を含める。属性本文と判断の実行許可は含めない。現在値だけでなく訂正・取消・将来発効の記録も取得できる。将来の有効日を迎えたときに同じ変更を再配信する契約ではない。公開履歴へ未接続の旧台帳は対象に含めず、過去の変更を推測しない。

limitは1から100件、既定25件とする。next_cursorは加工せず次のcursorへ渡す。同じ会社版・同じ資源の複数改訂でもページ境界で欠落しない。取得範囲を固定する場合は応答のthrough_revisionを後続の同名queryへ渡す。has_moreがfalseになるまで取得してからその会社版の反映を完了する。途中のページだけを一つのcommandの全変更として扱わない。

完了時のcursorはその会社版全体を読み終えた位置を表す。次の取得ではthrough_revisionを省略して新しい会社版まで取得できる。再送と独立したconsumerは同じ位置から再開でき、consumer側が保存する位置をサーバが共用・前進させることはない。資源の詳細は公開APIへ会社版を指定して取得する。

別会社のcursor、不正なcursor、現在より未来の会社版、cursorより前の取得上限は拒否する。DBや保存データの異常を空の完了ページとして返さない。
