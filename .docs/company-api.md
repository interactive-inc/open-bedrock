# Company API

`/company` 配下のresource APIは、会社の同一性、人、雇用、組織、責務、Account対応、人事発令を版付きresourceとして公開する。保存table、Drizzle型、旧整数ID、画面名、個別Appの語彙は契約へ含めない。実装は `api/src/contexts/company` に閉じ、HTTP runtimeとの接続だけを `api/src/api` が持つ。

## 共通前提

全operationは認証済みAccountを要求する。API compositionは製品固有のpermissionを、Companyが理解する`company:read`、`company:write`、`company:admin`へ写像する。Company serviceはAccount ID、Employee ID、許可されたorganization ID、capabilityだけを受け取り、session、role、JWT、Hono middlewareを知らない。

resource envelopeを扱うrequestは`x-company-organization-id`を必須とする。IDは1から255文字の空白を含まないopaque文字列であり、呼び出し側は接頭辞や内部値を分解しない。Actorのorganization scopeに含まれないIDはfail closedで拒否する。

read responseは`organizationId`、`organizationRevision`、`resources`を返し、同じatomic D1 batchでrevisionとresourceを固定する。`effective_on`または互換aliasの`as_of`を一つだけ指定できる。両方を異なる値で指定したrequest、実在しない暦日、100件を超えるID、重複IDはbad requestである。

writeは次のheaderを必須とする。

- `x-company-organization-id`: 変更対象organization
- `Idempotency-Key`: commandのopaque ID
- `If-Match`: 直前に読んだorganization revision

bodyは`reason`と1件以上100件以下の`resources`を持つ。Actor Account IDと記録時刻はbodyから受け取らずserverが設定する。全resourceは同じorganizationに属し、同じcommand内で`type + id`を重複させない。

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
- `POST /company/organization-changes`: 組織変更を一つのcommandとして適用
- `GET|POST /company/definitions`: Position、Grade、Responsibility、CollectiveBody
- `GET|POST /company/account-employee-links`: System AccountとEmployeeの対応
- `GET|POST /company/personnel-actions`: 人事発令

GETは`id` queryを繰り返して最大100件へ絞れる。`effective_on`を指定したreadはappend-only revisionからその日に有効な最新訂正を選び、将来発効の変更を過去へ混ぜない。`void`が発効した後はresourceを返さない。日付を省略したreadはcurrent headだけを返す。

POSTはendpointが所有するresource種別以外を拒否する。例えば`/people`からEmployeeを書いたり、`/organization-changes`からPositionを書いたりできない。

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

## 人と雇用の参照整合性

Employeeは同じorganizationのactiveなPersonを参照し、Employmentは同じorganizationのactiveなEmployeeを参照する。EmployeeのpersonId、EmploymentのemployeeIdは初回登録後に変更できず、取消時にも付け替えを拒否する。

Assignment、OfficeAssignment、OrganizationalAuthorityが持つemployeeIdとemploymentIdは、同じEmployeeの組み合わせでなければならない。ReportingRelationは本人と上司の両方を同じorganizationのactiveなEmployeeへ解決する。

activeな参照元が残るPerson、Employee、Employmentは取り消せない。従業員への参照にはAccount対応、上司関係、役職、責務、合議体への参加も含む。同一commandで参照元も取り消す場合は、参照元から順に保存する。

これらの検査は履歴のINSERT時にDB triggerで行い、違反は422のinvalid_resourceとして返す。失敗したcommandではresource、receipt、organization revisionと業務台帳の変更全体を取り消す。

公開APIから業務台帳へ接続したEmployeeは、Personの有効期間に含まれなければならない。雇用期間もEmployeeの有効期間に含まれなければならない。command確定時に全revisionから各発効区間を再構成し、参照先の空白、参照期間の短縮、同じEmployeeの雇用重複をDBで拒否する。Assignment、役職、責務などの全参照期間の検査は未完成である。

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

会社profileは初期化時から公開resourceを正本とする。接続前の会社名・代表者名は変更せず保全し、接続後は公開APIと既存の会社情報APIが同じ履歴を参照・変更する。初期化が作る所属は公開Assignmentと同じ期間対応を保持し、人事発令と公開APIから更新できる。責務・Account対応と既存所属の全保存経路の統合は未完成である。

公開Employeeへの上長付き配属・上長変更はReportingRelationへ記録し、人事発令が管理する直属上長をEmployee・Employment・OrgUnit・所属種別へ対応させる。役職変更では関係を維持し、所属終了・異動・退職では対応する期間を閉じる。独立したReportingRelationの追加と編集は引き続き可能である。対応する所属範囲外の関係や所有者変更は拒否し、公開APIでの所属終了には関係の同時終了を要求する。上長本人の退職時は部下側の公開関係も終了し、再入社だけでは復活させない。組織変更APIは雇用と上長関係の同時変更を受け付ける。将来予約、訂正時の後続編集の競合、複数上長の扱いは[公開所属と期間台帳](company-organizational-authority.md#公開所属と期間台帳)に記載する。

公開resourceに未接続の既存台帳、招待からの登録、製品固有の人物情報writer、未接続の組織・所属・責務・Account対応の保存先統合は未完成である。入社・再入社の発令は`employmentType`に`FULL_TIME`または`PART_TIME`を必須とする。新規従業員登録の入力名は`employment_type`である。選択した区分を承認対象の本文、発令記録、業務台帳、公開雇用へ保存する。再入社と訂正で新しく作る契約にも明示した区分を使い、以前の契約の区分を変更しない。

既存の組織一覧・組織ツリー・組織詳細・所属者一覧・本人の所属組織と、組織の作成・更新・削除は既定organizationの台帳を扱う。必要なCompany capabilityまたは操作permissionに加え、`organization:default`へのアクセスを必須とする。別organizationの管理者は参照・変更・成功済み変更の再送を行えない。プロフィール変更も対象organizationへのアクセスを検査する。接続済みのOrgUnitは公開APIと既存APIの変更を同じtransactionで両方の履歴へ保存する。公開APIで新設した既定organizationのOrgUnitと、接続済みの親から既存APIで新設したOrgUnitも接続される。既存の未接続OrgUnitは管理者による履歴確認を必要とする。

雇用区分の欠ける新規入力は400で拒否する。区分を含まない旧提案は、本文やdigestを変更せず承認・実行を409で拒否し、新しい申請を求める。既存の発令履歴に区分がなければ不明のまま参照し、推測して書き足さない。Webの入社・再入社フォームとCLIの`employees register --employment-type`も区分の選択を必須とする。

既存業務台帳は単一Companyを所有し、organizationを分離する列を持たない。EmployeeとEmploymentの公開writeは`organization:default`に限定し、別organizationは422で拒否する。複数organizationの従業員を同じ台帳へ混在させる機能は未完成である。

業務側の在籍認可、従業員一覧、Accountに対応する承認候補は、雇用・状態・所属の最新period revisionと会社営業日から参照する。接続済みのEmployeeの氏名・従業員番号・存在も、PersonとEmployeeの有効日から解決する。退職日の翌日を期間の終了日とし、将来退職の予約時に表示用の雇用statusが変わっても発効前のアクセスは失わせない。欠落・重複・所有者不一致がある現在期間は評価不能として拒否する。業務台帳を直接読む残る経路と、Account表示名の将来変更への対応は未完成である。

[外部identity同期](external-identity-imports.md)は機械主体を認証し、新規Accountと公開Person・Employee・Employment、初期人事記録、期間履歴を同じtransactionで保存する。既存の公開Personの氏名・email更新にも接続する。初期記録には明示された発効日・区分・理由と内容digestを残す。既存データの過去の状態を現在の雇用statusから補完する処理は持たない。

参照整合性とprojectionのmigrationは既存台帳・履歴を保全する。適用前の欠損参照や不足する雇用区分の修復、既存データの削除、既存台帳とresourceの所有関係の推測は行わない。履歴確認で接続できない既存データの修復と、未対応のresource種別の移行は未完成である。

`company-context.manifest.json`の`sourcePaths`はCompanyの全sourceを列挙し、`company-context.lock.json`はその全pathとhashを固定する。本リポジトリと共有先はDomain、Application、Infrastructure、Interface、testを含むCompanyディレクトリ全体を同一内容に保ち、CIは欠落、余分なpath、内容差を拒否する。製品差はCompanyの外側にあるAPI compositionだけで吸収する。

## 氏名と本人連絡先の変更

従業員詳細と本人profileの参照は、表示するPersonと同じsnapshotから`profile`を返す。`employeeId`、`organizationRevision`、`personRevision`、`effectiveOn`が編集対象を固定する。`personRevision`は予約された変更を含む最新の人物版であり、表示する値は会社営業日に有効な版から読む。

`PUT /company/employee-directory/:code`は氏名変更権限を検査し、`name`、`profile`、`reason`を受け取る。`PUT /company/my-profile`は会社範囲と本人のEmployee対応を検査し、`phone`、`profile`、`reason`を受け取る。両操作とも`Idempotency-Key`を必須とする。電話番号の`null`は明示した削除である。氏名変更からemailを変えるなど、別項目の入力は拒否する。

保存は、閲覧した会社版とPerson版の両方が一致した場合だけ行う。変更理由と主体を持つ人物履歴、従業員表示、Account表示名、command receiptを同じtransactionで確定する。Webは表示時の版と操作キーをフォームへ保持し、CLIは明示した版とキーを送る。409を最新版への自動再送で隠さない。

Employeeとの同一性を持つAccountの表示名はPerson側で管理する。Accountプロフィールからの直接改名は、対応期間の終了・取消後も拒否する。改名の事前確認後に対応が追加された場合も、保存するtransaction内で検出して変更を取り消す。同じ表示名の再送は書き込みを行わない。

変更は表示時の会社営業日から有効になる。将来のPerson変更がある場合、現在の区間の値を変更し、予約された別区間の値は保全する。営業日を越えた新しい保存は409を返して再確認を求める。成功済みの同じ操作は翌日や後続変更後も元の結果を返し、過去の履歴や現在値を再更新しない。

公開Personに未接続の従業員では`profile`が`null`になる。Webの編集入口は対応確認が必要な旨を表示する。存在しない版を指定した保存も409で拒否し、従業員台帳だけを変更しない。既存データの対応関係と有効期間を確認する移行は引き続き必要である。

## 既存従業員の公開履歴への接続

`GET /company/employee-resource-adoptions?employee_id=<id>` は従業員台帳、全雇用・在籍期間revision、接続状態、照合用digest、会社版、会社営業日を返す。既定organizationへのアクセスと `company:admin` が必要になる。

`POST /company/employee-resource-adoptions` は同じ参照の `employeeId`、`snapshotDigest`、`expectedRevision`、`observedOn` と、確認理由 `reason`、確認済みの `resources` を受け取る。`idempotency-key` headerは必須で、別内容による同じキーの使用は409になる。

resourcesには、一人のPerson、そのPersonに対応する既存IDのEmployee、保存済みの全契約と同じIDのEmploymentを指定する。それぞれのrevisionは1から連続させ、全体を100件以内とする。人物と従業員の有効期間は保存済みの雇用期間全体を覆い、現在の氏名・連絡先・従業員番号は台帳と一致する必要がある。雇用の所有者、契約名・区分、雇用期間と在籍状態の各区間を照合する。対応するAccountの会社表示名も現在の氏名と一致する必要があり、表示名の欠落・不一致は移行で上書きせず拒否する。

過去の氏名や従業員番号は管理者が確認した事実だけを入力し、現在値から推測して補完しない。期間履歴のない契約、部分接続、所有者の不一致、公開IDの衝突は接続しない。既定organization以外への移行や、既存の公開Personへの自動名寄せは行わない。

確認後の台帳・期間・会社版の変更は保存直前にも検査する。新規依頼が会社営業日を越えた場合も409になる。人物・従業員・雇用の公開履歴、既存台帳との接続、操作主体・理由・元のsnapshotを持つ変更不能な移行記録を一つのtransactionで保存する。元の台帳と期間履歴は変更しない。保存済みの同じ依頼は翌日以降も元の結果を返す。

CLIの `employees adoption --employee-id <id>` で照合対象を参照し、`employees adoption --data <confirmed-history.json> --idempotency-key <uuid>` で確認済みの履歴を送信できる。競合時に最新版への自動再送は行わない。

## 既存組織の公開履歴への接続

`GET /company/organization-resource-adoptions?organization_unit_id=<id>` は組織の同一性、保存済みの全期間revision、元の操作主体・理由・証拠・digest、接続状態、照合用digest、会社版、会社営業日を返す。既定organizationへのアクセスと `company:admin` が必要になる。

`POST /company/organization-resource-adoptions` は確認した `organizationUnitId`、`snapshotDigest`、`expectedRevision`、`observedOn`、確認理由 `reason` と `Idempotency-Key` を受け取る。親組織から順に接続し、期間IDと全revisionをそのまま公開履歴へ保存する。元の台帳・履歴は変更せず、元のsnapshotと移行主体・理由を変更不能な接続記録へ残す。一回の対象は一つの組織で、全期間revisionが1件から100件、元のsnapshotがUTF-8で750,000バイト以内でなければならない。

履歴の欠落、未完了の変更、既存の公開IDとの衝突、部分接続を拒否する。確認後の会社版・組織履歴の変更と営業日の変更は409になり、保存直前にも同じsnapshotを検査する。保存済みの同じ依頼は翌日以降も元の結果を返す。接続・公開履歴・会社版・移行記録の保存失敗では全体を取り消す。

接続後は会社版と組織操作の確定時にDBでも両方の最新期間を照合し、片側だけの更新を拒否する。将来の期間や取消済み期間は現在の組織一覧・詳細に混ぜない。既定organization以外の公開OrgUnitは単一Companyの既存台帳へ接続しない。所属・責務・Account対応の統合、既存組織編集画面が表示した版の照合は未完成である。

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
