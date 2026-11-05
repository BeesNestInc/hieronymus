# AI連携

Hieronymus と AI（エージェント・内部AI機能）の連携について説明します。

## 全体構成

```
ai/
├── host/                 本体AI機能の実行基盤（modelProvider・MCP群の結線）
│   ├── index.js            initializeAiHost(): hooks への注入と TEMPLATE_DIR 設定
│   ├── model-provider.js   config/llms.yaml の読み込みと ai-sdk モデル生成
│   ├── mcp-tools.js        voucher-mcp / expense-mcp を engine ツール群へラップ
│   ├── memory.js           メモリー（Aimemories）の読み書き
│   └── reflect.js          承認イベントからの振り返り（メモリー学習）
├── manifests/            AI機能ごとの Manifest 定義（実行は Legion manifest-engine）
├── prompt-templates/     プロンプトの文面（.md。コードを触らず調整できる）
├── manifest-engine/      legion-manifest-engine（submodule。変更は engine repo で）
├── mcp/
│   ├── voucher-mcp/        伝票入力MCPサーバ（HTTP API 経由）
│   └── expense-mcp/        経費精算MCPサーバ（HTTP API 経由）
└── skills/               外部エージェント向けの経理スキル
```

2つの上位連携があります:

* **本体AI機能**: 画面の「認識」ボタン等で動くAI（帳票OCR・科目提案・計算書の
  書式学習・起案ドラフトなど）を Legion の manifest-engine（Legionプロジェクトと
  共有のエンジン）で実行します（下記「本体AI機能の実行基盤」）
* **外部エージェント**: Claude Code / opencode / Legion などの外部AIエージェントが
  MCP（voucher-mcp / expense-mcp）で会計データを操作します（下記「MCPサーバ」）

## 本体AI機能の実行基盤（Legion manifest-engine）

本体のAI機能は `ai/manifests/` の Manifest 定義として実装され、`libs/vision.js`
などの呼び出し層から `manifest.execute()` で実行されます。

| Manifest | 機能 | 呼び出し元 |
|---|---|---|
| `ocr-voucher` | 帳票OCR（金額・消費税・取引先・請求番号） | `vision.extract`（証憑OCR・経費精算） |
| `ocr-statement` | 通帳・カード明細・計算書の明細行読み取り | `vision.extractStatement` |
| `rule-accounts` | 取込行の経費科目提案（カタログ内で分類） | `vision.suggestRuleAccounts` |
| `statement-profile` | 明細書式の解析プロファイル（yaml）起草 | `vision.draftStatementProfile` |
| `draft-voucher-slip` | 帳票OCR結果から仕訳伝票を起案（下書き） | `voucher-from-receipt` フロー |
| `reflect-voucher` | 承認済み伝票からメモリーを振り返り | 承認フック（メモリー学習） |
| `voucher-from-receipt` | 領収書→OCR→伝票起案(下書き)の tasks フロー | `runVoucherFromReceipt` |

プロンプトの文面は `ai/prompt-templates/*.md`（標準の方針は `standard.md`）なので、
読み取り指示の調整は **`.md` の編集だけで可能**です（コードは実行の組立と検証だけを
担当し、出力の検証（科目がカタログ内か・プロファイルの再解析との一致）は呼び出し側が行います）。

仕様の詳細は `ai/manifest-engine/README.md`（submodule のガイド）と `ai/index.md` を
参照してください。

### メモリー（履歴なし・記憶ありの方針）

本体AI機能は会話履歴を持ちません（リクエスト単位で完結）。代わりに**明示的な記憶**を
使います:

* **書き**: 伝票が承認されたタイミングで（起票の自動承認を含む）、`reflect-voucher`
  manifest が直近の伝票を観察して「このユーザーの定番パターン」（例: 「Amazon手数料は
  支払手数料(7030110)」）を `Aimemories` テーブルに蓄えます（`ai/host/reflect.js`。
  非同期で走り、失敗しても承認操作は影響しません。AI未設定・テスト環境では動きません）
* **読み**: 証憑OCR等が `memoryUserId` を渡すと、「これまでわかっていること」が
  リクエストに載ります（`ai/host/memory.js`）。未学習の環境では空で何もしません

テーブルは `Aimemories`（ユーザー×kind 'profile'/'learned'×key。migration
`20261106130000-add-aimemories.cjs`）として保持されます。

### 起案フロー（forceUnapproved）

領収書の画像から伝票を起案する tasks 型フロー（`voucher-from-receipt`）は、
**必ず未承認（draft）で伝票を作ります**（MCP `create_cross_slip` の
`forceUnapproved: true`）。承認は人が行います。承認権限のある代理ユーザーを使う
環境でも、AIの作成した伝票が自動承認されることはありません。

## MCPサーバ

`ai/mcp/` の MCPサーバは、HTTP API 経由で動作中の Hieronymus に接続します（セッションは
ログイン情報で確立します）。

### voucher-mcp（伝票・証憑）

伝票の作成/更新/承認/削除と、マスタの参照。tool一覧は `ai/mcp/voucher-mcp/README.md`。

* `create_cross_slip` には `forceUnapproved` 引数があります（承認権限者でも未承認で
  作成。AIの起案フロー用途）
* 税額計算・貸借一致などの検証は**サーバ側（権威計算）**で行われます
* `HIERONYMUS_READONLY=1` で書き込み系ツールを無効化できます

### expense-mcp（経費精算）

経費精算マッピング（支払先/出金元と勘定科目の対応）と精算書の操作。
tool一覧は `ai/mcp/expense-mcp/README.md`。

* 書き込み系ツールには会計権限を持つユーザーでのログインが必要です

### セットアップと認証情報

```bash
cd ai/mcp/voucher-mcp && npm install
cd ../expense-mcp && npm install
```

両サーバとも同じ環境変数を使います:

| 変数 | 説明 |
|---|---|
| `HIERONYMUS_BASE_URL` | 接続先 URL（既定 `http://localhost:3010`） |
| `HIERONYMUS_LOGIN_USER` | ログインユーザー名 |
| `HIERONYMUS_LOGIN_PASSWORD` | パスワード |
| `HIERONYMUS_READONLY` | `1` にすると書き込みツールを無効化（voucher-mcp） |

サーバは `import 'dotenv/config'` を持つので、**cwd の `.env` からも読みます**
（Legion から起動する場合は Legion の `.env` に置けば、yaml にパスワードを書く必要が
ありません。設定ファイルにクレデンシャルを置かない運用を推奨します）。

* **非会計ユーザー**: 伝票・証憑の作成は可能（承認待ちになる。AI経由の運用では
  `approvable=false` のユーザーを指定するのが安全です）
* **会計/承認ユーザー**: 承認・不承認・削除が可能（AIには非推奨。承認は人が行う）

### 経理スキル（外部エージェント向け）

`ai/skills/` に、AIエージェントが経理業務を行うための手順書を配置しています
（スキルの実体は人間も読める Markdown の手順書です）:

* **voucher-entry**: 証憑（画像/PDF）のOCR読み取り → 証憑登録 → 自動仕訳（承認待ち）の手順
* **voucher-management**: 証憑の登録・ファイル添付・確認・削除の手順
* **journal-learning**: 過去の仕訳日記帳から仕分けパターンを学習する手順

仕訳パターンは人間が確認・編集できる状態で管理されます（AIの編集に対し人の編集が常に優先）。

### opencode への登録

`~/.config/opencode/opencode.jsonc` の `mcp` に登録済み（voucher-mcp）。

## Legion（オーケストレータ）との連携

Legion リポジトリ側の `config/config.yaml` の `mcpServers` に voucher-mcp /
expense-mcp を登録してあります（`requiresApp: accounting-system`。会計アプリが
停止中は起動ヒント付きのエラーになります）:

```yaml
mcpServers:
  voucher-mcp:
    command: node
    args:
    - /home/ogochan/git/hieronymus.main/ai/mcp/voucher-mcp/index.js
    env:
      HIERONYMUS_BASE_URL: 'http://localhost:3010'
    requiresApp: accounting-system
  expense-mcp:
    ...同様...
```

クレデンシャルは Legion の `.env`（`HIERONYMUS_LOGIN_USER` / `HIERONYMUS_LOGIN_PASSWORD`）
に置きます（MCP が dotenv で読む）。`roles/accounting` が両 MCP を使う role 定義です。

## 本体AI機能の設定（config/llms.yaml）

`config/llms.yaml` は **Legion と同じ `llms:` 群形式**のみを扱います（json は廃止）。
未リリース版なので後方互換の書式はありません。例:

```yaml
llms:
  standard:
  # 群は優先順位リスト（上から試す。structuredOutput 失敗・添付能力切替で消費）
  - description: gemini（現行）
    provider: gemini                # gemini / openai / openai-compatible /
                                    # opencode_openai / local
    model: gemini-3.5-flash-lite
    apiKey: "..."
    accepts: [text, image, pdf]     # 添付（画像/PDF）受容能力（input-strategy）
    # structuredOutput: false       # generateObject 不使用モデル用
    # alternate: <候補名 or 群名>    # 失敗時の代替ラベル（候補名 or 群名）
  light:
  - standard                        # 他候補の参照でも群を作れる
```

* **環境変数**で解決済み候補のフィールドを上書きできます（テスト・一時切替用）:
  `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL`
* `LLM_MAX_RETRIES`（既定 `ai/host/index.js` が `1` を設定）: LLM 失敗時のエンジン側
  リトライ。帳票読み取りなどの単発処理は再試行1回が体感として適切です
* `TEMPLATE_DIR`（未指定時は `ai/prompt-templates`）: system prompt テンプレートの読み出し先
* **AI未設定**では、AI機能は `isAvailable()` が false になり**安全に無効化されます**
  （キーなし・接続先なしの環境でもエラーにはならず、単にAI要素が表示されません）
* エラーメッセージの契約: `AiNotConfigured`（設定なし）/ `AiApiError`（API異常）は
  呼び出し元の画面文言に反映されます。出力エラー表示のされ方とは異なります
* テンプレートの変更は `ai/prompt-templates/*.md` で行い、engine 自体（submodule）の
  変更は `~/git/legion-manifest-engine` で行って両 host で同步させるのが原則です
  （手順は `ai/manifest-engine/README.md`）

## 権限とセキュリティ

* AI（本体・エージェント経由どちらも）が作成する伝票は**承認待ち**で入ります。
  承認・不承認・削除は人間が行います
* エージェント経由の自動運用では、`approvable=false`・`accounting=false` の代理
  ユーザーを使うのが安全です（作成のみが出来る。`forceUnapproved` ともども2重の拘束）
* メモリー（Aimemories）はユーザー単位で記録されますが、内容は承認済み伝票からの
  観察（科目・表記ゆれ等）に限られます
