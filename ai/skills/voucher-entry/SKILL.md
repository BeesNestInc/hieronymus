---
name: voucher-entry
description: 証憑（画像/PDF）の読み取りから証憑登録・自動仕訳（承認待ち）までの手順
---

# Skill: 証憑入力と自動仕訳

画像/PDFの証憑を読み取り、証憑登録し、過去の仕訳パターンから**自動仕訳**して承認待ち伝票を作成する。

## 前提

- `describe_image`（describe-image MCP）: 画像/PDFのOCR
- `extract_document`（describe-image MCP）: 写真から文書領域の切り出し・正立化
- `voucher-mcp`: 証憑登録・仕訳伝票の作成・参照
- `knowledge/wiki/accounting/仕訳パターン.md`: 学習済みの仕分けパターン

## 手順

### 1. 写真なら文書領域を切り出す

証憑が**写真**（机の上などを適当に撮った画像）の場合は、`extract_document` で文書部分だけを切り出す:

```
extract_document {file_path: <写真パス>}
→ { count, documents: [{ file_path, width, height, corners }, ...] }
```

- 返るのは**透視・回転補正済みの正立画像のパス一覧**。1枚の写真に複数枚写っていても、それぞれ個別に切り出される
- **複数枚ある場合は、1枚ずつを別の証憑として扱う**（OCR→証憑登録を documents ごとに繰り返す）
- 切り出しに成功したら、その切り出し画像を以降の OCR・証憑添付に使う
- 文書が検出できない場合は、そのままの画像で OCR を試し、だめなら人間に確認する
- 検出は AI による推測のため、枚数・範囲が不自然なら人間に確認する

### 2. OCRで証憑を読み取る

`describe_image` を呼び、以下をJSONで抽出する:

```
この帳票から 会社名/発行日/金額/消費税/税率/請求番号/取引内容 を読み取り、
以下のJSON形式で出力してください:
{"company":"...","issueDate":"...","amount":...,"tax":...,"taxRate":...,"invoiceNo":"...","description":"..."}
不明な項目は null。
```

抽出結果は必ず読み手として確認する（金額の桁や会社名の誤読に注意）。

### 3. 取引先と伝票種別を特定する

- `get_companies` で会社名を照合して `companyId` を確定（部分一致可、一致しない場合は候補を複数挙げて人間に確認）
- `get_voucher_classes` で伝票種別（請求書/領収書/仕入 等）を選んで `voucherClassId` を確定

### 4. 証憑を登録する

`create_voucher_with_file` で証憑登録＋ファイル添付:

```
{voucherClassId, issueDate, companyId, amount, taxRuleId?, filePath, description?, invoiceNo?}
```

- `taxRuleId` は `get_tax_rules` で取得（省略時は税額0）
- 登録結果の `voucher.id` を保持する

### 5. 仕訳を決定する（自動仕訳）

`knowledge/wiki/accounting/仕訳パターン.md` を読み、証憑の「伝票種別 × 取引先」に合致するパターンを探す。

- **合致するパターンがある**: 借方/貸方科目をそのパターンに従って決定し、`create_cross_slip` で作成（承認待ち）
  - 証憑の方向: 伝票種別が `send=true` なら貸方側、`send=false` なら借方側に証憑IDを紐付ける
  - 明細行: `debitAccount/debitSubAccount/debitAmount` / `creditAccount/creditSubAccount/creditAmount`、証憑IDは `debitVoucherId` or `creditVoucherId`
- **パターンにない新規ケース**: 自動仕訳せず、推定の提案（借方/貸方の候補）を人間に提示して判断を仰ぐ
- 参考: 過去の類似仕訳は `get_journal` で確認できる

### 6. 承認待ちを確認・通知する

`list_cross_slips`（承認待ち）で作成した伝票が承認待ちに入っていることを確認し、人間に通知する。

## 注意

- 金額・日付・会社名の誤読は必ず人間が承認時に確認できるように、作成した伝票の摘要（`application1`）に「OCR: <取引内容>」を残す
- 自動仕訳が誤っていた場合は、その結果を `journal-learning` でパターンに反映する（自分の推測を「事実」にしない）
