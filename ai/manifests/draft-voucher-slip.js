import { Manifest } from '../manifest-engine/manifest.js';

// 帳票OCR結果から仕訳伝票を起案（下書き）する。voucher-from-receipt フローの
// 第2段。文面は ../prompt-templates/draft-voucher-slip.md。
// voucher-mcp のツール（useMcp）でマスタ確認と create_cross_slip を行う。
// 承認は人間が行う（manifest は approve を呼ばない。テンプレートで禁止）。
export const createDraftVoucherSlip = () => {
  return new Manifest({
    name: 'draft-voucher-slip',
    description: '帳票OCR結果と会計マスタを元に仕訳伝票を起案（下書き、未承認）する',
    systemPrompt: 'draft-voucher-slip',
    modelName: 'standard',
    temperature: 0.2,
    useHistory: false,
    useMcp: [ 'voucher' ],
  });
};
