# HTTP API

HTTP API は Principal、認可境界、resource、command、query、error、callback、client type の不変条件を保持する。

実装済み route は `api/src/contexts/*/interface/routes`、`api/src/api/routes`、生成物の `api/src/api/app.ts`、生成 client type は `api/dist/api/app.d.ts` で確認する。未実装の Principal と実行認可も、実装時に同じ制約を満たす。

認可は permission ベース(deny-by-default)で、権限のないリクエストは 403 を返す。ロールと permission の設計は [ロールと権限](./roles-and-permissions.md) を参照する。

## Principal と認証

現行 login は access token と refresh token を発行し、Bearer token で API を呼ぶ。未実装の Agent、Service、Connector も Principal として区別し、人間 token の共有で実現しない。

パスワード login と外部 identity login は同じ session 発行境界へ到達する。外部 identity token は API resource の Bearer token ではなく、`POST /auth/identity/login` または CLI callback が一回だけ受理する身元証明である。Web と CLI の code、PKCE、JWKS、session の契約は [Identity とセッション](./identity-and-sessions.md) に従う。

token または request context は少なくとも principal ID、principal kind、account または credential ID、session または execution ID を識別可能にする。人間の on-behalf-of 操作では requester と executor を別に記録する。

認証済みであることは操作許可を意味しない。permission、scope、field、state、case assignment、organizational authority、attestation を API が評価する。

[Deployment と法人](./architecture.md#deployment-と法人) の境界を API にも適用する。現行 route と schema に、法人 ID または tenant ID による routing、認可、database partition はない。外部 Organization または外部 tenant の ID は、業務対象または connector namespace としてだけ受理する。

## Resource と operation

- resource collection は複数形名詞にする。例は `/employees`、`/application-requests`、`/one-on-ones`
- 自分の resource は `/me` subresource にする。
- 承認待ちや担当案件は `/inbox` など関係が分かる subresource にする。
- 状態遷移は resource 配下の action POST にする。例は `/application-requests/:id/approve`
- 外部 provider 名を domain path と type へ埋め込まない。
- route 名だけで権限を決めず、application command に必要な policy を結ぶ。

CRUD で意味が不十分な操作は command として表す。申請の提出、承認、取消、訂正、archive、外部 dispatch は互いに異なる operation である。

## Command contract

副作用を持つ command は必要に応じて次を受け取る。

- target ID と expected revision
- idempotency key
- proposal digest または approved execution authorization
- normalized payload
- effective date または valid interval
- purpose と correlation ID

idempotency key は同じ意味の payload digest と結ぶ。同じ key で異なる payload が来た場合は conflict とする。外部 retry でも同じ key と causation を保持する。

## Query contract

list は `data` と `total`、または opaque cursor と `has_more` のどちらかを domain ごとに一貫して使う。offset pagination と cursor pagination の意味を同じ route で曖昧に混ぜない。

list、count、search candidate、detail は同じ scope と field policy を使う。認可対象外の resource を total、suggestion、error timing から推測できないようにする。

履歴、監査、機微情報の query は cache と prefetch を明示し、意図しない事前取得を避ける。

## Error contract

- `400`: request syntax または transport contract が不正
- `401`: 認証がない、無効、失効
- `403`: resource の存在を開示してよいが operation が許可されない
- `404`: resource がない、または存在を秘匿する
- `409`: revision、状態、idempotency、競合
- `422`: schema は読めるが domain validation を満たさない
- `429`: rate limit
- `503`: 必須 dependency、migration、connector が利用不能

error body は機械可読な安定 code、利用者向け message、必要な correlation ID を持つ。secret、raw external response、stack、認可対象外の値を返さない。

## 外部 command と callback

外部連携は個別 route から provider SDK を直接呼ばず、application port と outbox を使う。callback または webhook は次を満たす。

- connector 固有 path または routing key
- signature、timestamp、nonce、body digest の検証
- raw body size と content type の制限
- external event ID による deduplication
- inbox への永続化後に response
- versioned mapping による canonical assertion 変換
- domain application service による再認可または状態検査

callback の到着だけで内部業務を無条件に確定しない。

外部承認チャネルの callback は、送信された approver、proposal 内容、digest を正本として受理しない。署名と replay を検査し、外部利用者を HumanPrincipal へ解決し、一回限りの state token から proposal ID、revision、digest、対象 Principal、expiry を復元する。application service は Proposal、候補者、authority、RiskPolicy、state を再取得し、条件を満たす場合だけ HumanAttestation を作成する。

チャネルの identity assurance が必要な step-up を満たさない場合は、callback から業務変更を行わず、再認証できる Web 提供面を案内する。詳細は [AI 自動化と人間承認](./automation-model.md) を参照する。

## Client type

Web と CLI は `api/app` の `AppType` を type-only で import し、各 client 側で `hc<AppType>()` を生成する。API の実行時値を client へ import しない。

route または入出力を変更したら API type を再生成し、Web と CLI の typecheck を行う。CLI command route を追加したら `cli/app/index.ts` へ登録する。

## 適合確認

- route を介さず application side effect を呼べる bypass がない。
- Human、Agent、Service、Connector の認証 context を取り違えない。
- 同じ command を Web、CLI、Agent から送って同じ policy result になる。
- unknown field と overposting を拒否する。
- list と total に同じ authorization filter がかかる。
- stale revision、duplicate retry、同じ key の異なる payload を区別する。
- callback の署名不正、replay、重複、順序逆転を検査する。
- response、error、log に secret と不許可 field が含まれない。
