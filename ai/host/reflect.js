import models from '../../models/index.js';
import { initializeAiHost } from './index.js';
import { isAvailable } from './model-provider.js';
import { listAiMemories, replaceLearned } from './memory.js';
import { runManifest } from '../../libs/vision.js';

// 承認イベントからの振り返り。libs/cross_slip.js（approve含む create の
// auto-approve）と routes/api_cross_slip.js approve から発火し
// （fire-and-forget）、reflect-voucher manifest でユーザーのメモリーを更新する。
// LLM API 未設定・テスト環境ではサイレントにスキップする。

const SLIPS_LIMIT = 20;
const LINE_CHARS = 160;

const slipSummary = (slip) => {
  const lines = ( slip.lines || [] ).map((line) => {
    const parts = [];
    if ( line.debitAccount ) parts.push(`借:${line.debitAccount}${line.debitSubAccount ? `/${line.debitSubAccount}` : ''}`);
    if ( line.creditAccount ) parts.push(`貸:${line.creditAccount}${line.creditSubAccount ? `/${line.creditSubAccount}` : ''}`);
    parts.push(`${line.debitAmount ?? 0}円`);
    const app = ( line.application1 || line.application2 || '' ).slice(0, LINE_CHARS);
    if ( app ) parts.push(`摘要: ${app}`);
    return `  - ${parts.join(' ')}`;
  });
  return {
    year: slip.year,
    month: slip.month,
    day: slip.day,
    no: slip.no,
    lines: lines
  };
};

// 承認済み伝票（最近 SLIPS_LIMIT 件）をメモリー観察用に読む
export const recentApprovedSummary = async (userId) => {
  const slips = await models.CrossSlip.findAll({
    where: { createdBy: userId },
    // 承認されているものでも未承認でも観察材料になる（日本の会運用では
    // 承認待ちの伝票は本人の意が反映されているので観察に使う）
    include: [ { model: models.CrossSlipDetail, as: 'lines' } ],
    order: [ [ 'id', 'DESC' ] ],
    limit: SLIPS_LIMIT
  });
  return slips.map(slipSummary);
};

// ここから発火（非同期・失敗しても呼び出し側を固めない）
export const reflectFromVouchers = (userId) => {
  setTimeout(() => {
    runReflectFromVouchers(userId).catch((e) => {
      console.error('reflectFromVouchers failed:', e.message || e);
    });
  }, 0);
};

const runReflectFromVouchers = async (userId) => {
  if ( !userId ) return;
  if ( process.env.NODE_ENV === 'test' ) return;
  if ( !isAvailable() ) return;
  await initializeAiHost();
  const [ current, slips ] = await Promise.all([
    listAiMemories(userId),
    recentApprovedSummary(userId)
  ]);
  if ( slips.length === 0 ) return;
  const inputs = [
    'これまでわかっていること:',
    current.map((row) => `- ${row.kind === 'profile' ? '' : `${row.key}: `}${row.value}`).join('\n') || '（なし）',
    `最近の伝票（${slips.length}件）:`,
    JSON.stringify(slips)
  ];
  const { createReflectVoucher } = await import('../manifests/reflect-voucher.js');
  const result = await runManifest(createReflectVoucher(), { inputs: inputs });
  let object = null;
  try {
    object = JSON.parse(result);
  } catch (e) {
    return;
  }
  const notes = ( object && Array.isArray(object.memories) ) ? object.memories : null;
  if ( !notes ) return;
  await replaceLearned(userId, notes);
  console.log(`[ai] memory reflect ok (user=${userId}, notes=${notes.length})`);
};
