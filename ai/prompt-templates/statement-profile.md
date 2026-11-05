<%= await include('standard.md') %>

## 明細プロファイルyamlの起草

これは明細カード（通帳・カード明細・計算書）の取り込みデータと、AIによる読取り結果です。
次回以降の同じ書式の取り込みを「決定的に」解析するためのyamlプロファイルを起草してください。
yamlの様式:

  name: プロファイル名（銀行名やカード名。40字まで）
  type: bank   # CSV/Excelの銀行明細。または card: カード明細PDF。または settlement: ECモール等の計算書
  # type: bank の場合:
  detect:      # ヘッダ行に全部含まれていたらこの形式とみなす語の配列
    - 日付
  columns:     # 列名→項目。項目は date/description/amountOut/amountIn/balance/amount/merchant/memo
    date: お取引日
  # type: card の場合:
  cardName: ミツイスミトモカード   # 銀行側の引落摘要に含まれる名称
  cardPatterns:
    # 総額と支払日を取る正規表現（グループで取り出す部分だけ）
    total: '支払い合計額([\d,]+)円'
    payDate: '支払い日(\d{4})年(\d{1,2})月(\d{1,2})日'
  # type: settlement の場合（ECモールの支払明細書など「振込1本の内訳書」）:
  detect:                  # テキストに全部含まれたらこの形式とみなす語
    - 支払明細書
  aggregateSale: '^売上\s*￥'      # 売上の集計行（この行の後ろに内訳が続く）
  aggregateExpense: '^支出\s*￥'   # 支出の集計行（この行の後ろに内訳が続く）
  transferPattern: '振込|純利益'   # 振込行（入金の合計）を引くラベル
  transferDatePattern: '(\d{4})/(\d{1,2})/(\d{1,2})に、.*?口座へ'   # 振込日が書かれた文
  memoPattern: '^銀行振込ID'      # 振込ID等のメモ行

ルール:
- 与えた読取り結果の各列の意味からcolumns/cardPatterns/計算書の節見出しを推定すること。
- 正規表現は過度に一般化しない（この書式に合う最小限）。
- total/payDateの正規表現は、数値の直前にある語（ラベル）を含めること（([\d,]+)だけだと他の数値に当たる）。
- settlementでは、計算書の売上・支出・振込の**見出し語そのもの**（読取り結果のラベルに現れた語）をdetect/aggregate*/transferPatternに使うこと。
- settlementに saleAccount/receivedAccount（約束科目）を書いてはいけない（科目は各環境の勘定次第なので、利用者が後で足す）。
- 決めない部分は省略すること（yamlのdefaultsを模倣しない）。
- yamlそのものだけを出力すること（説明やコードフェンスを付けない）。

リクエスト本文に「書式の種類のヒント」「取り込みデータの材料」「AI読取の結果」が載る。
出力は {"profile": "<yaml概要テキスト>"} のJSON（yamlそのものを profile フィールドに載せる）。
