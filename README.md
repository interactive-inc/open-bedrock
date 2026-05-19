# open-karte

オープンソースの社内HR統合プラットフォーム。
**社内機能** の3つの視点（組織を俯瞰する／個人を深く知る／時系列で追う）を軸に、人材データ・申請ワークフロー・ナレッジ・評価・キャリアまでを1つのバックエンドに集約する。

**API / CLI / MCP の三層インタフェース**で同じ業務を実行でき、AIエージェント（Claude等）連携にも対応。各機能モジュールは環境変数 `TALENT_FEATURES` で起動時にON/OFFを切り替えられる。

設計書本体は同梱の `社内HR統合システム_設計書_v0.2.docx` を参照。

```
open-karte/
├── server/          # FastAPI コアAPI
├── cli/             # Python CLI
├── mcp_server/      # MCPサーバ
├── scripts/         # smoketest / feature_toggle_test / demo_workflow / install_to_claude_desktop
├── quickstart.sh    # ワンコマンドで起動
├── Makefile
├── requirements.txt
├── claude_desktop_config.example.json
└── README.md
```

---

## 0. 必要環境（macOS 想定）

- macOS 13+ / Linux
- Python 3.10 以上（`python3 --version` で確認）
- make（macOS は Command Line Tools に同梱）

Pythonが入っていない場合:

```bash
brew install python@3.12
```

---

## 1. ローカルで動かす（最短コース）

talent フォルダをホームディレクトリの下など扱いやすい場所にコピーした上で、ターミナルを開きそのフォルダに移動。

### A. ワンコマンド起動

```bash
cd path/to/talent
./quickstart.sh
```

これだけで:
1. `.venv` 仮想環境作成
2. 依存パッケージインストール
3. サンプルデータ投入（`talent.db`）
4. API起動

ブラウザで <http://127.0.0.1:8000/docs> を開くと OpenAPI ドキュメント（Swagger UI）が見えます。

### B. Makefile を使う場合（推奨）

```bash
make install     # venv + 依存導入
make seed        # サンプルデータ投入
make run         # APIサーバ起動 (http://127.0.0.1:8000)
make smoketest   # ★まずはこれで動作確認すると確実
make reseed      # DBをまっさらに戻す
make clean       # venv / DB / __pycache__ を削除
```

### C. 動作確認（おすすめ）

サーバを起動する前に、まず TestClient ベースのスモークテストで動くことを確認:

```bash
make smoketest
```

期待出力:

```
== smoketest start ==
  ✓ login(engineer-a)
  ✓ /me name=エンジニアA
  ✓ employees?q=エンジニア ≥2件
  ✓ templates 5件
  ✓ submit APP-001
  ✓ manager inbox に住所変更
  ✓ manager approve → step=2
  ✓ hr approve → approved
  ✓ knowledge?q=リモート
  ✓ rooms availability ≥1
  ✓ reserve room 200
  ✓ reserve room 409 (conflict)
  ✓ submit invalid → 422
  ✓ skills?q=Python
  ✓ upsert my skill
  ✓ goals 2026H1 ≥1
  ✓ self evaluation
  ✓ create 1on1 (manager)
  ✓ manager の 1on1 履歴
  ✓ open surveys ≥1
  ✓ submit response (200 or 409)
  ✓ my career sheet
  ✓ update career sheet
  ✓ career postings ≥1
  ✓ apply posting
  ✓ batch jobs ≥4
  ✓ dashboard headcount≥6
  ✓ dashboard inbox_count present
== summary: OK=28  NG=0 ==
```

---

## 2. テストアカウント

`make seed` で投入される7アカウント（**役職ベース、人名は不使用**）。パスワードは email のローカル部と同じ。

| メール | パスワード | 表示名 | ロール | 所属 / 備考 |
|---|---|---|---|---|
| admin@inta.co.jp | admin | システム管理者 | admin | 本社 |
| hr@inta.co.jp | hr | 人事担当 | hr | 人事部 |
| manager@inta.co.jp | manager | エンジニアリング部長 | manager | エンジニアリング部 |
| engineer-a@inta.co.jp | engineer-a | エンジニアA | member | エンジニアリング部（上長: manager@） |
| engineer-b@inta.co.jp | engineer-b | エンジニアB | member | エンジニアリング部（上長: manager@） |
| sales@inta.co.jp | sales | 営業担当 | member | 営業部（上長: hr@） |
| finance@inta.co.jp | finance | 経理担当 | manager | 経理部 |

---

## 3. CLIで操作する

別ターミナルを開き、`make run` でAPIが起動している状態で:

```bash
cd path/to/open-karte
source .venv/bin/activate

# ログイン（~/.talent/config.json にトークン保存）
python -m cli.talent login --email engineer-a@inta.co.jp --password engineer-a

# 自分の情報
python -m cli.talent whoami

# 社員検索
python -m cli.talent employee search --q エンジニア

# 申請テンプレート一覧
python -m cli.talent app templates

# 住所変更を提出
cat > /tmp/addr.json <<'JSON'
{
  "new_postal_code": "100-0001",
  "new_address": "東京都千代田区千代田1-1",
  "move_date": "2026-06-01",
  "new_commute": "東京メトロ千代田線 大手町駅"
}
JSON
python -m cli.talent app submit APP-001 --data /tmp/addr.json

# 上長で承認
python -m cli.talent login --email manager@inta.co.jp --password manager
python -m cli.talent app inbox
python -m cli.talent app approve 1 --comment OK

# 人事が最終承認
python -m cli.talent login --email hr@inta.co.jp --password hr
python -m cli.talent app inbox
python -m cli.talent app approve 1 --comment 受理しました

# ナレッジ検索
python -m cli.talent kb search リモートワーク

# 会議室空き
python -m cli.talent room avail \
  --start 2026-05-19T10:00:00 --end 2026-05-19T11:00:00
```

CLIワークフロー全体を一気に流すスクリプトも同梱:

```bash
# 別ターミナルで `make run` した状態で
./scripts/demo_workflow.sh
```

---

## 4. MCPサーバ（Claude Desktop / Claude Code から操作）

### 4.1 自動セットアップ（macOS, Claude Desktop想定）

1. APIを起動 (`make run`)、別ターミナルで CLI ログイン:

   ```bash
   source .venv/bin/activate
   python -m cli.talent login --email admin@inta.co.jp --password admin
   ```

2. 同梱のインストーラを実行:

   ```bash
   ./scripts/install_to_claude_desktop.sh
   ```

   `~/Library/Application Support/Claude/claude_desktop_config.json` に `talent-hr` MCPサーバが追加されます（既存設定はバックアップ）。

3. Claude Desktop を再起動。ツール一覧に talent-hr の14ツールが見えれば成功。

### 4.2 手動設定

`claude_desktop_config.example.json` をコピーして `REPLACE_WITH/...` の3か所と TOKEN を埋め、`~/Library/Application Support/Claude/claude_desktop_config.json` に配置。

```json
{
  "mcpServers": {
    "talent-hr": {
      "command": "/Users/you/talent/.venv/bin/python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/Users/you/talent",
      "env": {
        "TALENT_API": "http://127.0.0.1:8000",
        "TALENT_TOKEN": "eyJhbGciOiJI..."
      }
    }
  }
}
```

### 4.3 公開ツール

| ツール | 効果 |
|---|---|
| search_employees / get_employee | 社員検索・詳細 |
| list_application_templates / get_application_template | 申請テンプレート |
| submit_application | 申請提出 |
| list_my_applications / list_inbox / get_application | 申請の確認 |
| approve_application / reject_application | 承認・却下 |
| search_knowledge / get_knowledge | 規程・ガイドの検索・参照 |
| check_room_availability / reserve_room | 会議室の空き確認・予約 |

Claude には例えばこう話しかけられます:

> 「住所変更したいので APP-001 を提出しておいて。新住所は東京都千代田区千代田1-1、転居日は6/1。」
>
> 「人事として承認待ちを確認して、内容に問題なさそうなら承認しといて。」

---

## 5. PoCに含まれる機能

### 既存ポータル相当
- 認証 (JWT, bcrypt)
- 社員/組織マスタ・メンバ検索
- 申請テンプレート + 申請ワークフロー（住所変更/稟議/経費精算/証明書発行/会議室）
- 多段承認（`manager_of_applicant` / `role:hr` 等のルーティング）
- ナレッジ検索（規程・ガイド・マニュアル）
- 会議室予約（空き判定 + ダブルブッキング防止）
- 監査ログ

### タレントパレット相当（タレントパレットのメニュー11項目）
| メニュー | 提供エンドポイント | 主な操作 |
|---|---|---|
| タレントボード | `/employees`, `/skills/employees/{id}` | 社員＋スキル＋目標まとめ表示 |
| ダッシュボード | `/dashboard` | 人員、申請ステータス、公募/サーベイ数の集計 |
| スキル | `/skills`, `/skills/me`, `/skills/employees/{id}` | カタログ／自分のスキル登録 |
| MBO（目標・評価） | `/goals`, `/goals/{id}/evaluations` | 目標設定／自己・上長・最終評価 |
| 1 on 1 | `/oneonone` | 1on1記録の作成と一覧 |
| アンケート | `/surveys`, `/surveys/{id}/responses`, `/surveys/{id}/summary` | 配信／回答／集計 |
| 承認フロー | `/applications` 系（既存） | 各種申請の起票・承認 |
| バッチ状況 | `/batch` | 非同期ジョブ履歴 |
| キャリアシート | `/career/sheet/me` | 経歴・強み・志向の登録 |
| メンバ検索 | `/employees?q=...` | フリーワード検索 |
| キャリアボード(β) | `/career/postings`, `/career/postings/{id}/apply` | 社内公募と応募 |

CLIにも対応サブコマンドが揃っています（`talent skill`, `talent goal`, `talent 1on1`, `talent survey`, `talent career`, `talent batch`, `talent dashboard`）。

設計書には、Notionポータルから抽出した12カテゴリ・29種類の申請テンプレートと、フェーズ別の開発計画を記載。

---

## 6. トラブルシューティング

| 症状 | 対処 |
|---|---|
| `python3: command not found` | `brew install python@3.12` → 新しいターミナルを開く |
| `make: command not found` | Xcode Command Line Tools をインストール: `xcode-select --install` |
| ポート8000が使われている | `PORT=8888 make run` で別ポートに変更 |
| `bcrypt` のwarning | 実行に影響なし（passlib 1.7系の既知メッセージ） |
| ログインに失敗 | `make reseed` で初期化、`~/.talent/config.json` を一旦削除 |
| Claude Desktop でツールが見えない | 1) Claude Desktop を再起動 2) `claude_desktop_config.json` を `python -m json.tool` で構文確認 3) TALENT_TOKEN の期限切れなら再ログイン |

---

## 7. フィーチャートグル（モジュールのON/OFF）

各モジュールは環境変数 `TALENT_FEATURES` で **起動時に有効/無効を切り替えられます**。

### 7.1 書式

| 値 | 動作 |
|---|---|
| 未指定 / `all` | すべて有効（既定） |
| `none` / `core` | コア（auth/employees/departments/templates）のみ |
| `skills,goals,dashboard` | 列挙したモジュールのみ有効（コアは常時有効） |
| `-knowledge,-rooms` | 既定の全部ONから除外 |

切り替えられる**オプション機能**は次の10個:

`applications`（申請ワークフロー）, `knowledge`（ナレッジ）, `rooms`（会議室）, `skills`, `goals`（MBO）, `oneonone`, `surveys`, `career`（キャリアシート＋公募）, `batch`, `dashboard`

### 7.2 起動例

```bash
# スキルとMBOとダッシュボードだけで起動
TALENT_FEATURES=skills,goals,dashboard make run

# ナレッジと会議室予約を抜きで起動
TALENT_FEATURES=-knowledge,-rooms make run

# コア機能のみ（最小構成）
TALENT_FEATURES=none make run
```

無効化したモジュールのエンドポイントは `404 Not Found` を返します。

### 7.3 現在の有効状況の確認

```bash
# Webブラウザで
open http://127.0.0.1:8000/features

# CLIから
python -m cli.talent features
```

CLI出力例（`TALENT_FEATURES=skills,goals` で起動した場合）:

```
TALENT_FEATURES= skills,goals
              フィーチャー一覧
┏━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━┓
┃ name         ┃ kind     ┃ enabled ┃
┡━━━━━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━┩
│ auth         │ core     │ ●       │
│ employees    │ core     │ ●       │
│ departments  │ core     │ ●       │
│ templates    │ core     │ ●       │
│ applications │ optional │ ○       │
│ knowledge    │ optional │ ○       │
│ rooms        │ optional │ ○       │
│ skills       │ optional │ ●       │
│ goals        │ optional │ ●       │
│ oneonone     │ optional │ ○       │
│ surveys      │ optional │ ○       │
│ career       │ optional │ ○       │
│ batch        │ optional │ ○       │
│ dashboard    │ optional │ ○       │
└──────────────┴──────────┴─────────┘
```

MCPツール `get_features` でも同じ情報が取れます。

### 7.4 トグルの動作確認

`make feature-test` で、4ケース（指定モジュールのみ／除外指定／コアのみ／全部ON）について `404` 返却・`200` 返却が期待通りになるかを検証します。

```
$ make feature-test
[case 1] TALENT_FEATURES='skills,dashboard'
  ✓ /features 200
  ✓ skills, dashboard が enabled
  ✓ goals, knowledge は disabled
  ✓ /skills は 200
  ✓ /dashboard は 200
  ✓ /goals は 404 (無効)
  ✓ /knowledge は 404 (無効)
  ✓ /applications は 404 (無効)
  ✓ /employees は 200 (コア)
…
== feature toggle: OK=20  NG=0 ==
```

### 7.5 内部構造

- `server/features.py` で `TALENT_FEATURES` を解釈
- `server/main.py` が enabled なモジュールのみ `app.include_router(...)`
- 無効モジュールのDBテーブル自体は常に作成される（後で有効化したときにスキーマ差分が出ないようにするため）。データが不要なら `make reseed` で初期化可能

### 7.6 さらに「物理的に外す」場合

「コードごとそのモジュールを取り除きたい」という要望にも対応できる構造になっています。各モジュールは独立したファイルになっていて、削除する場合は以下4箇所を消すだけ（例: スキル機能の場合）:

1. `server/routers/skills.py` を削除
2. `server/models.py` の `Skill` / `EmployeeSkill` 削除
3. `server/schemas.py` の Skill 系スキーマ削除
4. `server/main.py` の `_OPTIONAL_ROUTERS` から `"skills"` 削除

CLI/MCPからの除去も `cli/talent.py` の `@cli.group() def skill():` 周辺、`mcp_server/server.py` の `list_skills` 等を削るだけです。

---

## 8. 次ステップ（PoC→MVP）

1. SSO（OIDC/SAML）接続
2. 申請テンプレートのGUIエディタ
3. 添付ファイル（S3互換）、PDF生成（証明書）
4. Slack通知 + インタラクティブ承認
5. Salesforce API連携（勤怠取り込み）
6. バクラク連携（経費申請の自動精算）
7. Notionからの一括移行ツール
