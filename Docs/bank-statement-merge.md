# 伝票統合（deposit merge / placeholder merge）の仕様

明細取り込み（通帳・カード）で仮起票された伝票と、計算書・経費精算書から起票された伝票が
**同じ取引**を指すとき、起票のタイミングで自動的に1本にまとめる仕組み。
二重計上（同じ取引の2伝票）を「後から突合する」のではなく「起票した瞬間に統合する」のが設計の核。

| 方向 | 統合 | 残る伝票 | 廃棄される伝票 |
|---|---|---|---|
| IN（入金） | 計算書複合伝票 ↔ 入金仮の仮伝票 | **通帳側**の仮伝票 | 計算書側の伝票 |
| OUT（出金） | 精算書の伝票 ↔ 出金仮の仮伝票 | **精算書側**の伝票 | カード/通帳側の仮伝票 |

実装は一括で `libs/bank-reconcile.js`。実装記録は `Docs/logs/20261104.md` の追記30〜32。

## 方向ごとの条件と処理

### IN: 計算書伝票 → 入金仮伝票に統合

関数: `findDepositMergeCandidates(settlementSlip)` / `mergeSettlementIntoDeposit(settlementSlip, user)`。

**発火点**: `settleStatement()`（計算書の伝票化）の起票直後。候補が**ちょうど1つ**のときだけ自動
（0件・複数件は従来どおり計算書側の伝票を残す。フォールバックは計算書ビューの
「入金仮伝票と統合」ボタン → `GET /api/bank_statement/:id/merge_candidates` /
`POST /api/bank_statement/:id/merge_settlement`）。

**候補の条件**（両方を満たす未承認の入金仮伝票が対象）:

- 伝票が未承認・精算書未紐付（`expenseReportId` null）・会計年度ロック中でない
- 候補明細: `creditAccount = 3900000（入金仮）`、`debitAccount` が預金（`/^101/`）で
  借方金額 = 計算書側伝票の銀行借方明細（**ちょうど1行**であること）と同額
- 口座一致: 仮明細の借方の `Financial`（accountCode+subAccountCode 解決）が、
  計算書側の銀行借方の `Financial` と同一
- 実通帳の行に紐付いている: 候補明細に `BankStatementLine`（`owner.kind !== 'settlement'`）の
  binder がある（計算書同士の突合はしないという条件）
- 伝票日付差 ≤ 3日（`options.days`）
- 計算書側の伝票についても: 未承認・全明細が計算書の取込行に紐付いていること
  （`kind: settlement` の statement のみが binder であること。他の伝票由来行が
  混ざる伝票は「計算書側の伝票」ではないので、候補外にする）。銀行借方明細が1行でない場合も候補外
  （金額は借方合計ではなく1行の金額のみが使われる）

**処理**（単一トランザクション・貸借検算つき。合わなければロールバック）:

1. 候補の仮明細: 借方（銀行）を保持し、**貸方（入金仮）を外す**。計算書側の銀行借方明細に
   貸方（売上高等）があればそれを引き受ける（`absorbCredit`）
2. 計算書側のその他の明細（費用行等）を候補伝票に**新規明細として移設**
   （`lineNo` は末尾に継続。application と voucher 紐付を保持）
3. 計算書側の取込行の紐付け（`BankStatementLine.crossSlipDetailId`）を新しい明細へ再指定。
   振込行は**通帳側の銀行明細が指す明細**に統合される（通帳行+振込行が同一明細に束ねられ、
   `suggestSettlementDeposits` の「bankBound 判定＝重複防止」と整合する）
4. 計算書側の伝票の明細・伝票を廃棄（未承認のみ。承認済みには決して触れない）
5. 候補伝票の `lineCount` を実数で、`updatedBy` を更新（**年月日・番号は変更しない**=
   実入金日を生かす）
6. 学習: `learnFromSlip(候補伝票)`（通帳側の摘要から相手方を覚え直す。update フックと同じ方針）

返し: `{ merged: true, slip: 候補伝票, discarded: 計算書側伝票id }`。
`settleStatement` は統合成功時 `{ slip, merged: true, discarded }` を返す
（routes の settle 応答は `mergedInto` に載せる。UI はトーストで通帳側の伝票番号を報告する）。

### OUT: 精算書の伝票 → 出金仮の伝票に統合

関数: `findSpendMergeCandidates(realSlip)` / `mergeSpendIntoPlaceholder(realSlip, user)`。

**発火点**: `createSlipForReport()`（経費精算書の承認→起票）の各行の起票直後。
候補1つのときだけ自動。複数候補・条件不一致は**何もしない**
（伝票が重複したままになる。手動突合 = 仮伝票の「削除」+ 精算書の伝票を取込明細と
手動突合、または再承認で現行化。UI の自動フォールバックボタンは未実装）。

**候補の条件**:

- realSlip（精算書側）に `expenseReportId` があること（精算書経由の伝票）。**承認済みでも対象**
  （内容は一切変えず、取込行の突合先の付け替えと仮伝票の廃棄だけが起きるため。統合対象の
  realSlip には 会計年度ロック中でないことの検査もある）
- realSlip 全明細が同一出金元（credit）で立つこと（`groupLines` の約束: 同一伝票=同一出金元）。
  credit の `Financial`（口座の accountCode+subAccountCode 解決）が解決できること。
  credit が預金（`/^101/`）のときは扱わない（借方に立つ銀行は IN 方向で扱う）
- 仮明細: `debitAccount = 1900000（出金仮）`、`debitAmount` = realSlip の出金元 credit 合計と同額、
  `creditAccount` の `Financial` が realSlip と同一の口座
- 仮伝票が未承認・`expenseReportId` null・実取り込行（`kind !== 'settlement'` の binder）に紐付いている
- 伝票日付差 ≤ 3日（`options.days`）

**処理**（単一トランザクション）:

1. 取り込行（`kind !== 'settlement'` の binder。仮明細に付いていたもの）の
   `crossSlipDetailId` を **realSlip の代表行**（credit=出金元の最初の明細）に付け替える。
   代表行にすでに別の取り込み行 binder があるなら二重運用と見て止める（保険）
2. 仮伝票の明細・伝票を廃棄（紐付けは付け替え済みのなので痕跡なし）
3. **内容の移設は不要**（精算書側の伝票が「借: 費用 / 貸: カード」の完成形で、
   伝票日付=ユーザー入力の支払日）。`ExpenseReportLine.crossSlipId` も realSlip のまま
4. 学習: 起票フック（`createCrossSlip` ライン）で既に走っているので、統合では追加で走らせない

返し: `{ merged: true, slip: realSlip, discarded: 仮伝票id }`。

立替精算（`payment.advance`、credit = 仮払金 1130000）は `Financial` 解決に失敗して
対象外になる（カード・口座取り込み行との統合が対象）。

## 不変の制約（共通）

- **承認済みの伝票は内容を変えない**。IN 統合は両方未承認を要求し、OUT 統合は
  realSlip の内容を変えないので承認済みでも対象にする（イヤな事故を防ぐための線引き）
- 二重検算: IN 統合は移設後の貸借が合わなければロールバックする。金額一致（同額）が
  前提なので相互矛盾は起こらない設計
- `reconcilePlaceholders()`（既存の単行差し替え）は併存する。精算書由来の伝票を
  差し替え先から除外する既定は継続する（OUT は本件の統合が担当する）
- 伝票番号（`CrossSlips.year/month/no` unique）: 廃棄された伝票の番号は欠番になるが
  採番整合（slipCount）には影響しない（IN: 通帳側の番号を生かす。OUT: 精算書側の番号を生かす）

## 未実装・運用上の注意

- OUT の自動フォールバック（複数候補を画面から手動統合する UI）は未実装
  （手動 = 仮伝票を「削除」してから、カード行を精算書の伝票に「計算書と突合」相当で突合）
- ±3日の許容日数は `options.days` で全方向共通（未指定=3）
- 集計型精算書伝票: realSlip の「同一出金元の credit 合計」で突き合わせるため
  （1行複数明細の group 起票に対応）。ただし binder の紐付けは代表行1行に付ける
  （1明細=1取り込み行の制約を守る）

## テスト

`test/bank-deposit-merge.test.js`（IN 4本: happy/複数候補/日付超過/承認済み保護）、
`test/card-merge.test.js`（OUT 4本: happy/複数候補/日付超過/仮承認済み）。
教訓: `createCrossSlip` の返りはプレーンオブジェクト（`expenseReportId` 等が乗らない）。
判定には DB から引き直すこと。数値 assert は DECIMAL が string で返るので `Number()` 経由に。
