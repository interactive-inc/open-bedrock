# Company API

Company の公開契約は、Employee profile、指定時点の Workforce state、指定時点の組織 snapshot、原子的な組織変更で構成する。保存table、整数ID、旧部署投影、画面名、個別Appの語彙は契約へ含めない。

すべての operation は Bearer認証を要求する。Company migration が `verified` でない場合は旧投影へ戻らず、`company_migration_incomplete` で停止する。これにより同じAPIがdeploymentごとに異なる正本を読む状態を許さない。移行時に確定した`baseline_on`より前の履歴はcanonical Companyの事実ではないため、推測せず`company_as_of_before_baseline`で拒否する。migrationに記録した会社timezoneとruntime設定が一致しない場合も、営業日の意味が変わったまま履歴を解決せずunavailableにする。

## Employee directory

`GET /company/v1/employees` は `employee_id` queryを一個以上、最大百個まで受け取る。同じquery名を繰り返して複数IDを指定する。

Employee IDはopaque文字列である。呼び出し側は接頭辞や内部の数値を分解しない。応答は指定順の `employees` と、見つからなかった `missing_employee_ids` を分ける。見つからないIDを黙って別のEmployeeへ解決しない。

このoperationは氏名、employee code、連絡先を横断して返すため、`employee:lifecycle:read:all` を要求する。Account role名からこのpermissionを推測しない。

## Workforce state

`GET /company/v1/employees/:employee_id/workforce-state` は `as_of` を必須とする。応答はEmployee ID、Employment status、Employment ID、主務、兼務、Responsibilityと、その解決に使ったorganization revisionを返す。

本人は自分の状態を読める。本人以外は`employee:read`に加え、全社読取permission、直属上司、対象組織のMANAGER責務、管理系列のいずれかを必要とする。Technical Permissionだけで対象範囲を拡大せず、Account roleを会社資格へ変換しない。対象範囲を確認できない場合は存在を隠してnot foundにする。

組織資格のsnapshotとWorkforce stateのorganization revisionが一致しない場合はconflictにする。権限だけを古い組織で評価し、状態だけを新しい組織で返すことはない。

## Organization snapshot

`GET /company/v1/organization-snapshots` は `as_of` を必須とする。応答は一つのorganization revision、指定日に有効なOrgUnit、Assignment、Responsibilityを返す。

OrgUnitは親OrgUnit IDを持つフラットな集合として返す。木構造はこの親参照から決定的に構成でき、同じ事実を入れ子とフラット配列へ二重に表現しない。廃止済み、void、指定日に無効なperiodは含めない。

全社の所属と責務を一括で返すため、`employee:lifecycle:read:all` を要求する。snapshot取得中にorganization revisionが変わった場合は結果を返さない。

## Organization change

`POST /company/v1/organization-changes` は次を一つのcommandとして受け取る。

- `operation_id`
- `expected_revision`
- `as_of`
- `recorded_at`
- 変更理由`reason`
- 根拠を指す`evidence_references`
- 新しいOrgUnit identity
- OrgUnit period version
- Assignment period version
- Responsibility period version

各periodにoperation IDと記録時刻を重複入力させず、最上位の値を全periodへ適用する。actor Account IDはrequest bodyから受け取らず、検証済みsessionからserverが設定する。理由と根拠参照は必須であり、根拠参照はcontext、kind、opaque ID、versionを持つ。呼び出し側が主体を詐称したり、同じ変更内で異なる記録主体や記録時刻を混ぜたりする余地を作らない。

`Idempotency-Key` headerは`operation_id`と同じ値を必須とする。operationはactor、理由、根拠参照を含む入力全体のSHA-256 fingerprintへ結び付ける。同じoperation IDと同じ内容の再送は保存済みrevisionを`replayed: true`で返し、periodを追加しない。同じoperation IDを異なる主体、理由、根拠または変更内容へ再利用した場合は`organization_operation_conflict`で拒否する。

変更には`employee:lifecycle:apply`と、指定時点で有効な`PEOPLE_OPERATIONS` Responsibilityの両方を要求する。一方だけでは実行できない。Responsibility保持者に対応するactiveなSystem Accountがない場合も拒否する。

Applicationは変更後の全OrgUnit、全Workforce schedule、期間、revision、参照、循環、監査入力をwrite前に検証する。DBはexpected revision、operation fingerprint、連続period revision、追記専用、全件完了を再検査する。actor、理由、根拠参照、fingerprintはoperationと同じatomic batchで保存し、後から更新できない。成功応答は全変更が同じbatchで確定した場合だけ返す。

## Error contract

形式不正と`Idempotency-Key`不一致はbad request、baselineより前の`as_of`と変更後の会社事実が不正な場合はunprocessable、stale organization revisionとoperation ID再利用はconflict、認証不足はunauthorized、permissionまたはResponsibility不足はforbiddenとなる。

移行未完了、snapshot不整合、途中revision変更、保存層障害は、旧投影や部分結果で補わずunavailableにする。error responseは機械判定用の`code`を持つ。revision conflictだけは再読込判断に必要な`actual_organization_revision`も返す。

## Compatibility

既存のemployee、department、personnel action APIは既存clientのwire互換を保つadapterである。新しい統合はCompany APIを使い、整数Employee ID、旧Department row、Account role、現在値だけのemployee列を正本として扱わない。

Personnel Actionによる所属と責務の変更は同じCompany validatorとorganization operationを通る。旧projectionが必要な期間もcanonical transactionからだけ派生し、旧wireとCompany APIを別々にwriteしてはならない。

旧wireが表現できないOrgUnit kind、opaque ID、任意Responsibility、過去時点snapshotを旧形式へ縮退してはならない。その能力を必要とするclientはCompany APIへ移行する。

認証には移行を実行するAccount自身が必要なので、migrationが未完了の間だけSystemの認証control planeは旧Employeeのactive状態をログイン可否のbootstrapに使える。これはmigration endpointへ到達するための限定例外であり、Company API、組織上の対象範囲、判断候補、業務認可へ旧組織事実を使う許可ではない。migrationが`verified`になった後は認証もcanonical Workforce stateだけを使う。
