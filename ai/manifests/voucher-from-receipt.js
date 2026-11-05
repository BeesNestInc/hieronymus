import { initializeAiHost } from '../host/index.js';
import { Manifest } from '../manifest-engine/manifest.js';
import { createOcrVoucher } from './ocr-voucher.js';
import { createDraftVoucherSlip } from './draft-voucher-slip.js';

// 領収書・請求書の画像/PDF → OCR → 仕訳伝票の起案（下書き）までを1つの
// tasks 型 manifest で回すフロー。承認は人が行う（作成は未承認で入る）。
// imagePath は帳票画像（PDF可: 事前に vision.js と同様の正規化を呼び出し側が
// 行う前提。libs/vision.js prepareImage 相当。ここでは受け取ったパスをそのまま
// 添付する）。実行には Hieronymus API 認証が要る（HIERONYMUS_LOGIN_USER / PASSWORD）。
export const runVoucherFromReceipt = async ({ imagePath, note } = {}) => {
  await initializeAiHost();
  const ocr = createOcrVoucher();
  const draft = createDraftVoucherSlip();
  const flow = new Manifest({
    name: 'voucher-from-receipt',
    description: '領収書・請求書の画像/PDFをOCRし、仕訳伝票を起案（下書き）する（承認は人）',
    tasks: [
      { task: 'ocr', manifest: 'ocr-voucher', inputs: [{ input: 'request', label: '指示' }] },
      {
        task: 'draft',
        manifest: 'draft-voucher-slip',
        inputs: [
          { input: 'request', label: '指示' },
          { input: 'result:ocr', label: '帳票読み取り結果（OCR）' }
        ]
      }
    ],
    useHistory: false
  });
  const roles = {
    'voucher-from-receipt': { name: 'voucher-from-receipt', manifests: { 'voucher-from-receipt': flow } },
    'ocr-voucher': { name: 'ocr-voucher', manifests: { 'ocr-voucher': ocr } },
    'draft-voucher-slip': { name: 'draft-voucher-slip', manifests: { 'draft-voucher-slip': draft } }
  };
  const { result } = await flow.execute({
    roles: roles,
    role: 'voucher-from-receipt',
    requests: [{ name: 'request', input: note || '領収書の画像から仕訳伝票を起案してください。' }],
    params: { chatImages: { value: [ imagePath ] } }
  });
  return result;
};
