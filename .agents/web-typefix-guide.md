# web 型不整合の修正ガイド（hc で顕在化した本物のズレ）

hc 化でレスポンス型が正確（api の実レスポンス = snake_case の素の型）になった結果、コンポーネント側の前提とのズレが型エラーになった。これらは本物のバグなので直す。

## エラーの種類と直し方

1. **TS2551 / プロパティ名が camelCase（asset.holderEmployeeId 等）**:
   - 原因: 旧 lib/api は snake_case → camelCase 変換していたが、hc 直叩きで api の実レスポンス（snake_case）になった。
   - 直し方: コンポーネント側のプロパティアクセスを **api の実レスポンスの snake_case** に合わせる。`asset.holderEmployeeId` → `asset.holder_employee_id`、`asset.purchasedOn` → `asset.purchased_on` 等。エラーメッセージの "Did you mean 'xxx'?" が正しい名前。
2. **TS2367 / status 比較が常に false（status === "approved" 等が型エラー）**:
   - 原因: hc レスポンスの status は `string`（api が `text()` で返す）。リテラル "approved" との比較が「型が重ならない」エラー。
   - 直し方: 比較自体は正しいロジックなので残す。status の型を string として扱えばよい。具体的には、比較箇所で status を string とみなす（多くは `status === "approved"` のままで、status の型が string なら TS2367 は出ないはず → 出るのは status が別の enum 型に注釈されている場合）。コンポーネントが status を `ApplicationStatus` 等の enum 型に注釈している箇所を、レスポンスの実型（string）に合わせる。enum を使った表示ラベル変換（to-xxx-label）に渡すときは、その関数の引数型を string 受け入れに広げるか、コンポーネントで string のまま扱う。
3. **TS2322 / string を Enum 型に代入**:
   - 原因: 同上。レスポンスの string を、コンポーネントの props（Enum 型）に渡している。
   - 直し方: props 型を string に広げるか、レスポンスの値をそのまま使う。Enum の制約が表示用なら、表示関数側で string を受ける。
4. **TS2353 / オブジェクトリテラルに余分なプロパティ**: レスポンス型に合わせてプロパティを調整。

## 方針

- **api の実レスポンス（snake_case の素の型）を正とし、コンポーネント側をそれに合わせる**。api 側のレスポンス形は変えない（CLI/web 両対応の snake_case 契約）。
- 変換関数（to-xxx-label 等）の引数型は、string を受け入れるよう広げてよい。
- 旧 lib/api/types/\*.ts の手動 Entity 型（camelCase）でもう使われないものは削除可。ただし入力型・props 型として使われているものは残す。
- セミコロンは付ける（web semi:true）。@/ 絶対パス。

## 完了確認

- 担当ファイルの bunx tsc --noEmit でそのファイルのエラーが消える。
- ランタイム（描画ロジック）は変えない（プロパティ名・型注釈の修正のみ）。

## 報告

修正したファイル、エラー種別ごとの件数を報告する。
