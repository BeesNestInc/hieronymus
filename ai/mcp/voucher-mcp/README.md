# voucher-mcp

Hieronymus（会計システム）に伝票・証憑を入力するための MCP サーバです。

## 概要

- HTTP API 経由で動作中の Hieronymus に接続します（`/api/*`）
- セッションはログイン情報（ユーザー名/パスワード）で確立します（cms-mcp と同じパターン）
- 仕訳伝票・証憑の作成/更新/承認/削除と、必要なマスタ情報の参照を提供します
- 税額の計算・貸借一致などの検証は **サーバ側（権威計算）** で行われます。本 MCP は最小ペイロードを送信し、サーバの再計算結果が正となります

## セットアップ

```bash
cd ai/mcp/voucher-mcp
npm install
```

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `HIERONYMUS_BASE_URL` | 任意 | 接続先（既定 `http://localhost:3010`） |
| `HIERONYMUS_LOGIN_USER` | 必須 | ログインユーザー名 |
| `HIERONYMUS_LOGIN_PASSWORD` | 必須 | パスワード |
| `HIERONYMUS_READONLY` | 任意 | `1` にすると書き込み系ツールを無効化 |

要件: ログインユーザーの権限を伝票のロールモデルに合わせて設定してください。

- **非会計ユーザー**: 伝票・証憑の作成は可能（`.approvable=false` なら承認待ちになる）
- **会計/承認ユーザー**: 承認・不承認・削除が可能（`.approvable=true`）

## opencode への登録

`~/.config/opencode/opencode.jsonc` の `mcp` に登録済み。ユーザー名/パスワードの設定を忘れずに。

## ツール一覧

### 読み取り
| ツール | 内容 |
|---|---|
| `get_accounts` | 勘定科目・補助科目（税区分付き） |
| `get_companies` | 取引先一覧 |
| `get_voucher_classes` | 伝票種別 |
| `get_tax_rules` | 指定日に有効な税率ルール |
| `get_fiscal_year` | 指定年月の会計年度 |
| `get_cross_slip` | 仕訳伝票取得（年/月/号） |
| `list_cross_slips` | 伝票一覧（既定: 承認待ち） |
| `list_vouchers` | 証憑一覧 |

### 書き込み
| ツール | 内容 |
|---|---|
| `create_cross_slip` | 仕訳伝票作成（税額はサーバ自動計算） |
| `update_cross_slip` | 未承認伝票の更新 |
| `approve_cross_slip` / `disapprove_cross_slip` | 承認 / 不承認 |
| `delete_cross_slip` | 未承認伝票の削除 |
| `create_voucher` / `update_voucher` / `delete_voucher` | 証憑の登録 / 更新 / 削除 |
| `compute_slip_taxes` | 税額計算のプレビュー（保存しない。実保存時の税額はサーバが再計算） |

## ワークフロー（非会計ユーザー → 承認）

1. 非会計ユーザーが `create_cross_slip` / `create_voucher` で入力（承認待ち）
2. `list_cross_slips` で対象を特定
3. 会計/承認ユーザーが `approve_cross_slip` で承認
4. 修正が必要な場合は `disapprove_cross_slip` → `update_cross_slip` → 再承認

## テスト

```bash
# 手動確認用テストクライアント
node test-client.mjs   # MCP_USER=<user> MODE=read|create|approve で指定
```

Web アプリ側の統合テストはリポジトリルートで実施します。

```bash
NODE_ENV=test npx mocha test/tax-calc.test.js test/e2e.test.js
```