import models from '../models/index.js';

const listAll = (kind) => {
  const where = kind ? { kind: kind } : {};
  // 表示順は検索キー順（並べ替えは運用上意味を持たないため）
  return models.ExpenseMapping.findAll({
    where: where,
    order: [
      [ 'key', 'ASC' ]
    ]
  });
};

export default {
  // 支払先/出金元の選択は一般従業員にも必要なため、取得は認証済み全ユーザー
  // （書き込み権限は libs/permission.js で会計権限に制限）
  // ?kind=payee / ?kind=payment で種別に絞り込める（設定画面の2テーブル用）
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      // ?kind=payee のクエリ、または /expense_mapping/payee のパスで種別に絞り込める
      const kind = req.query.kind || req.params.kind || null;
      const mappings = await listAll(kind);
      res.json({
        values: mappings
      });
    } catch (e) {
      console.log(e);
      res.json({
        code: -1
      });
    }
  },
  // table-maintenance の差分更新（更新/削除/新規が混在した配列を受け取る）
  // パスで種別を指定した場合（/expense_mapping/payee 等）、新規行はその種別で登録され、
  // 応答もその種別に絞り込まれる
  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const kind = req.params.kind || null;
    try {
      const values = req.body.values;
      for ( const value of values ) {
        if ( value.kind === 'sundries' ) {
          continue;
        }
        if ( value.id ) {
          const mapping = await models.ExpenseMapping.findByPk(value.id);
          if ( mapping ) {
            if ( !value.name && !value.account ) {
              await mapping.destroy();
            } else {
              mapping.set(value);
              await mapping.save();
            }
          }
        } else {
          if ( value.name || value.account ) {
            await models.ExpenseMapping.create({
              ...value,
              kind: value.kind || kind
            });
          }
        }
      }
      const mappings = await listAll(kind);
      res.json({
        values: mappings
      });
    } catch (e) {
      console.log(e);
      res.json({
        code: -1
      });
    }
  }
};
