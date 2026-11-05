import { Manifest } from '../manifest-engine/manifest.js';

// 帳票OCR（証憑抽出）。libs/vision.js の extract() が使う。
// system テンプレートは ../prompt-templates/ocr-voucher.md。
// 取引先候補・支払先マッピング・自社名などの動的データは、実行時に
// requests の本文（リクエスト本文）として渡す（候補はメッセージに
// 載る。Legion manifest-engine README「5. messageRecipe / requests」）。
// 添付画像は実行時 params.chatImages（ファイルパス配列）で渡す。PDFは
// host 側で画像化しておく（vision.js prepareImage）。

// 抽出スキーマ（構造化出力用。読めない項目はnullを許す）。libs/vision.js
// の旧 VOUCHER_SCHEMA と同一の項目。
const VOUCHER_SCHEMA = {
  type: 'object',
  properties: {
    company: { type: ['string', 'null'] },
    companyId: { type: ['number', 'null'] },
    payeeMappingId: { type: ['number', 'null'] },
    issueDate: { type: ['string', 'null'] },
    paymentDate: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    tax: { type: ['number', 'null'] },
    taxRate: { type: ['number', 'null'] },
    invoiceNo: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] }
  },
  required: ['company', 'companyId', 'payeeMappingId', 'issueDate', 'paymentDate', 'amount', 'tax', 'taxRate', 'invoiceNo', 'description'],
  additionalProperties: false
};

// Manifestの生成は都度（config/llms や環境変数の変更を呼び出しのたびに
// 反映する。Manifest は初回 initialize で modelProvider の結果をキャッシュして
// 持つため、単一インスタンスの使い回しは設定変更を吸わない）
export const createOcrVoucher = () => {
  return new Manifest({
    name: 'ocr-voucher',
    description: '領収書・請求書などの帳票画像/PDFをOCRし、金額・消費税・取引先・請求番号等を抽出する',
    systemPrompt: 'ocr-voucher',
    modelName: 'standard',
    // OCRは決定的に。旧実装（generateObject 時の値未指定）より確実な挙動
    temperature: 0.1,
    useHistory: false,
    outputSchema: VOUCHER_SCHEMA,
  });
};
