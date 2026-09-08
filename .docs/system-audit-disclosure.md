# System監査の開示制御

System監査台帳の一覧と詳細は、既存の読取権限に加えて、保存された開示設定を適用する。対象は `/system/audit-events` と `/system/audit-events/:eventId` が読む `system_audit_events` である。Companyの独立した監査台帳、添付の内容、業務データ全体のfield policyは、この設定の対象に含めない。

## 開示する範囲

設定のscopeは全体を表す `"*"` または閲覧者のSystem Account IDである。全体とAccountの有効な設定を両方適用する。Accountの設定で全体の制限を広げられない。設定がないscopeは追加の制限を持たず、既存の読取権限を使う。

`allowedFields` は `actor_account_id`、`target_id`、`reason_code`、`authorization_json`、`before_json`、`after_json`、`metadata_json` のうち、開示する項目を明示する。空配列はこれらすべてを非表示にする。非表示の値は `null` に置き換え、応答の `redacted_fields` に列名を返す。イベントID、action、対象種別、結果、発生時刻は、対象行を開示する場合に返す。

`allowedTargetTypes` は対象種別の許可リストであり、`null` は種別を制限しない。空配列は対象行を返さない。設定は一覧・詳細・件数へ同じように適用し、非表示のactorや対象IDを検索して元の値の存在を推測できないようにする。対象外の詳細は404を返す。

`allowedPurposes` が `null` でなければ、読取queryの `purpose` を明示する必要がある。省略・不一致は403になる。目的は要求者の申告値を照合・記録するものであり、実際の利用目的を外部で証明する仕組みではない。

`expiresAt` はUTCの期限であり、その時刻以降は403になる。期限切れで無制限へ戻らない。`enabled: false` の新版は、そのscopeの制限を解除する。他のscopeの制限は継続する。

## 設定API

`GET /system/audit-disclosure-policies?scope=...` は現在の設定を返す。未設定なら `policy: null` になる。現在のHumanPrincipalとglobalの `system:admin` 権限を要求する。

`POST /system/audit-disclosure-policies` は設定の新版を公開する。同じ資格に加えて `x-system-step-up` による再認証を要求する。入力は次の項目を持つ。

- `scope`、再送を識別するUUIDの `commandId`、現在の版を示す `expectedRevision`
- `enabled`、`allowedFields`、`allowedTargetTypes`、`allowedPurposes`、`expiresAt`
- 変更理由の `reason`

初回の期待版は0とする。scopeごとの版を順に追記し、設定と変更前後の監査を同じtransactionで保存する。記録済みの版は更新・削除できない。Account指定時は実在するAccountを要求する。

同じ主体・再送キー・内容の再送は元の結果を返す。別内容、別主体、古い期待版は409になる。設定公開は201、成功済みの再送は200を返し、応答に `policy` と `replayed` を含める。再送時も現在の資格を検査する。

## 読取と競合

読取開始時の時刻で資格と設定を評価し、Accountの状態・token版・権限の付与元と設定版を読み出しのtransactionで再検査する。結果を返す前の読取監査でも同じ検査を行う。途中で設定や資格が変わった場合は本文を返さず、再試行を要求する。未来に記録された設定を古い時刻で読む要求は拒否する。

読取と設定APIは `Cache-Control: no-store` を返す。System APIの読取権限はglobalの `audit:read` または `system:admin` である。設定による制限は管理者の監査読取にも適用する。

製品が同じSystem監査台帳を別の画面やCSVへ合成する場合は、Systemの開示済みの射影と検索条件を使い、表示情報の付加後にも設定版を検査する。非表示のAccountから氏名やemailを補完せず、製品固有の追加の非表示条件も維持する。
