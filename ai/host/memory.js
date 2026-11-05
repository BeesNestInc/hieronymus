import models from '../../models/index.js';

// AIメモリー（振り返りで蓄える）の読み書き。履歴（useHistory）を使わない
// 運用の代わりに、明示的な記憶レイヤーとして DB（Aimemories）を使う。
// manifest 実行時には「これまでのことがわかっていること」のテキストとして
// リクエスト本文に載せる（engine の Memory ストアは使わない。DBが権威）。
//
// kind: 'profile'（このユーザーの基本バラバラ事、key=''）/'learned'
// （振り返りで蓄える項目、key=見出し）。 Lego の persona memory と同じ
// 「使うときに読む・書くは承認イベントなど明示的な振り返り時」。

// ユーザーのメモリーをレコード配列で取得する（未登録なら []）
export const listAiMemories = async (userId) => {
  if ( !userId ) return [];
  return await models.Aimemory.findAll({
    where: { userId: userId },
    order: [ [ 'kind', 'ASC' ], [ 'createdAt', 'ASC' ] ]
  });
};

// manifests の文脈に載せるテキスト。空なら ''（読み取り時に障害にしない）
export const memoryText = async (userId) => {
  try {
    const rows = await listAiMemories(userId);
    if ( rows.length === 0 ) {
      return '';
    }
    const lines = [];
    for ( const row of rows ) {
      const value = String(row.value || '').trim();
      if ( !value ) continue;
      if ( row.kind === 'profile' ) {
        lines.push(`- ${value}`);
      } else {
        const key = String(row.key || '').trim();
        lines.push(`- ${key ? `${key}: ` : ''}${value}`);
      }
    }
    if ( lines.length === 0 ) {
      return '';
    }
    return [ 'これまでわかっていること（このユーザーの定番パターン・好み）:', ...lines ].join('\n');
  } catch (e) {
    return '';
  }
};

// メモリーを置き換える（learned 群の full replace。振り返り manifest の出力が
// 現状の全ノートを持ち帰る設計なので、置き換えで不要な項目も削られる）。
export const replaceLearned = async (userId, notes) => {
  const t = await models.sequelize.transaction();
  try {
    await models.Aimemory.destroy({
      where: { userId: userId, kind: 'learned' },
      transaction: t
    });
    let count = 0;
    for ( const note of ( notes || [] ).slice(0, 30) ) {
      const key = String(( note && note.key ) || '').slice(0, 120);
      const value = String(( note && note.value ) || '').slice(0, 4000);
      if ( !key || !value ) continue;
      await models.Aimemory.create({
        userId: userId,
        kind: 'learned',
        key: key,
        value: value
      }, { transaction: t });
      count += 1;
    }
    await t.commit();
    return count;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};
