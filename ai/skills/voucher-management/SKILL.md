---
name: voucher-management
description: 証憑（電子化証票）の登録・ファイル添付・確認・削除の手順。証憑の保存と管理を行う
---

# Skill: 証憑管理

証憑（電子化証票）の登録・ファイル（画像/PDF）の添付・確認・削除を行う。証憑から仕訳伝票を作る場合は `voucher-entry` スキルを使う。

## 前提

- `voucher-mcp` の証憑系ツール: `create_voucher` / `create_voucher_with_file` / `get_voucher` / `list_vouchers` / `attach_voucher_file` / `list_voucher_files` / `delete_voucher_file` / `update_voucher` / `delete_voucher`
- マスタ参照: `get_companies`（取引先）/ `get_voucher_classes`（伝票種別）/ `get_tax_rules`（税率）

## 手順

### 1. 証憑の登録（新規）

- `get_companies` で `companyId`、`get_voucher_classes` で `voucherClassId` を特定
- `get_tax_rules` で発行日に有効な `taxRuleId` を取得（省略時は税額0）
- ファイル添付あり: `create_voucher_with_file`（`filePath` に画像/PDFを指定）
- ファイルなし: `create_voucher`
- 金額・日付・会社名は、OCRまたは入力情報と突き合わせて間違いがないか確認してから登録する

### 2. 既存証憑へのファイル添付

- 登録時にファイルを添付し忘れた場合は `attach_voucher_file` で後から添付
  ```
  {id: <証憑ID>, filePath: <画像/PDFパス>}
  ```

### 3. 証憑・ファイルの確認

- `get_voucher`（ID指定）で証憑情報と添付ファイルの一覧を確認
- `list_vouchers`（期間・取引先・金額で絞り込み）で該当証憑を検索
- `list_voucher_files`（証憑ID指定）で添付ファイル一覧を確認

### 4. 証憑・ファイルの更新 / 削除

- 情報の修正: `update_voucher`（作成者または会計権限者のみ）
- ファイルの削除: `delete_voucher_file`（ファイルID指定）
- 証憑自体の削除: `delete_voucher`（作成者または会計権限者のみ。仕訳伝票に紐付いた証憑は削除できない場合がある）

## 注意

- **削除は慎重に**: 会計の証憑は証拠資料のため、削除前に本当に不要かを確認する。仕訳伝票に紐付いた証憑のファイル・証憑削除は避ける
- 権限: 証憑の更新・削除は**作成者または会計権限者**に限られる（ログインユーザーの権限で制限される）
- 証憑を仕訳伝票に使う場合は、明細行の `debitVoucherId` / `creditVoucherId` に証憑IDを指定して紐付ける（`voucher-entry` 参照）
