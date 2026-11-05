import { Manifest } from '../manifest-engine/manifest.js';

// 通帳・明細の読み取り（明細行配列のOCR）。libs/vision.js の extractStatement()
// が使う。system テンプレートは ../prompt-templates/ocr-statement.md。
// 添付画像は実行時 params.chatImages（ファイルパス配列）で渡す（PDFは host 側
// で画像化済み）。出力は配列のJSONテキスト。構造化出力は使わない（outputSchema
// なしだと engine は generateText で回る）。テキスト+サルベージの解析は host が
// 行う（旧実装と同じ検便）。

export const createOcrStatement = () => {
  return new Manifest({
    name: 'ocr-statement',
    description: '通帳・カード明細・計算書の画像/PDFから入出金の明細行をすべて読み取る',
    systemPrompt: 'ocr-statement',
    modelName: 'standard',
    // 明細行の読み取りは決定的に
    temperature: 0.1,
    useHistory: false,
  });
};
