# 監査台帳の再レビュー修正計画

規範性: 非規範記録。種別は実装計画 snapshot。製品要件と実装済み状態は仕様正本、コード、migration で判定する。

この文書は作成時点の実装計画であり、現在の仕様または完了証明ではない。現在の挙動はコードとテストで確認する。

## 目的

- cursor 履歴を無制限に保持せず、監査一覧を逆方向へ移動できるようにする。
- 保存された Unicode の byte 列を置換せず正確に読む。
- export の query 数を database の無料枠に収める。

## 設計概要

正規 cursor は snapshot、limit、filter、source range、target range を固定する。read projection は SQLite の storage class を検証し、許可した text を BLOB の byte 列から fatal decode する。export は descriptor と通常の HEX payload を一つの位置 parameter query で取得し、分割 row を固定 bind 数で全体 batch する。

## 制約

- database の無料枠では Worker invocation 当たりの query 上限があるため、repository export の上限をその半分以下にする。
- string、BLOB、row の size 上限を超えない。
- text payload は大文字 HEX で database 境界を越し、runtime 固有の BLOB 表現へ依存しない。
- cursor は bounded、canonical、position-only とし、認可情報を持たせない。
- 直前 page への逆移動は元 range を正確に復元する。さらに過去への逆移動は page grouping が変わっても、欠落と重複のない連続 range を保つ。

## Cursor と可変幅 pagination

対象:

- `api/src/lib/audit/audit-cursor.ts`
- `api/src/lib/audit/audit-cursor.test.ts`
- `api/src/infrastructure/audit/audit-event-repository.ts`
- `api/src/infrastructure/audit/audit-event-repository.test.ts`

契約:

- 入力は安定した `(created_at, id)` 順序と `AuditEventFilters`。
- 出力は snapshot 最大 ID、limit、filter fingerprint、source range、target range を固定した canonical cursor。

- [x] 可変幅 fixture、直前 page の完全復元、連続した逆移動、filter と limit の変更拒否、snapshot 後の追加除外を失敗 test として追加する。
- [x] cursor と repository の対象 test で既存の重複 failure を確認する。
- [x] cursor parse、encode、range 検証を bound SQL で実装する。
- [x] 対象 test が成功するまで確認する。

## Byte を保持する Unicode read

対象:

- `api/src/infrastructure/audit/audit-event-repository.ts`
- `api/src/infrastructure/audit/audit-event-repository.test.ts`

契約:

- 入力は database の `typeof(column)` と BLOB または HEX projection。
- 出力は保存済み text の完全な復元、または安全な `503 audit_unavailable`。置換 decode と型 coercion を行わない。

- [x] 不正 byte、同じ長さの置換 adversary、数値または BLOB の storage corruption、BOM、正しい Unicode、不正 JSON の fixture を追加する。
- [x] 変更された text が漏れる既存 failure を確認する。
- [x] 通常 read と大容量 read に storage class 検証と fatal decode を実装する。
- [x] 対象 test が成功するまで確認する。

## Export の query budget と remote 制限

対象:

- `api/src/infrastructure/audit/audit-event-repository.ts`
- `api/src/infrastructure/audit/audit-event-repository.test.ts`
- `.docs/plans/2026-07-14-audit-ledger-design.md`
- `.docs/plans/2026-07-14-audit-ledger-implementation.md`

契約:

- 入力は descriptor-first export と CSV byte counter。
- 出力は最大件数と remote-compatible な stress path を repository の query budget 内で処理した結果。

- [x] 最大件数、その一件超過、remote-compatible な大容量 row の query 数 assertion を追加する。
- [x] 既存実装の過剰 query 数を対象 test で確認する。
- [x] 累積 raw size と wire size の guard を保ち、descriptor window を拡張する。
- [x] database 上限を超える fixture を、上限未満の row を使う検証へ置き換える。
- [x] 大容量 metadata、分割 row、少量 row を混在させる正式 fixture を追加する。
- [x] compact descriptor query で通常 HEX を返し、分割計画を一つの JSON bind と許可 column case で全体 batch する。
- [x] ordinal、identity、actor、storage class、length、欠落、重複、順序、HEX、Unicode を検証する。
- [x] 最大件数、上限超過、CSV byte 境界で query 数と結果を証明する。
- [x] window ごとに decode 後の HEX と layout を破棄し、保持 memory の上限を検査する。
- [x] result row 全体の conservative estimate と column 上限で、通常 read から bounded segment へ切り替える。
- [ ] 対象 test、API 全 test、typecheck、`vp check`、diff、秘密情報を確認し、必要な変更だけを commit する。
