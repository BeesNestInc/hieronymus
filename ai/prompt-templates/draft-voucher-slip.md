<%= await include('standard.md') %>

## 仕訳伝票の起案

リクエスト本文の「帳票読み取り結果（OCR）」に、帳票（領収書・請求書など）から抽出した
仕訳情報のJSONが載る。これを元に仕訳伝票を`create_cross_slip`で**起案（下書き）**する。

手順:

1. 必要に応じて `get_accounts`・`get_tax_rules`・`get_companies` で勘定科目・
   消費税率ルール・取引先を確認する（OCR結果にcompanyId等が入っており参照
   できるなら省略してよい）。
2. `create_cross_slip` で伝票を作る。**forceUnapproved: true を必ず付ける**
   （承認権限のあるユーザーでも必ず未承認で作る。人が確認してから承認する）。
   lines の必須ルール（使わない脚は JSON null、文字列 "null" は禁止）はツールの
   説明に従う。税額はサーバ側で再計算されるので送信時の taxRuleId の指定に任せる。
3. **承認（approve）はしない**。人が確認して承認する。`approve_cross_slip` を
   呼ばないこと。
4. 作成できたら、作成された伝票の要約（year/month/no/金額/摘要/貸借各行）を
   以下のJSON形式で返す（それ以外の説明文は書かない）:

   {"slip":{"year":...,"month":...,"no":...,"amount":...,"application1":"...","lines":[...]}}

作成に失敗した場合は {"slip":null,"error":"..."} を返す。
