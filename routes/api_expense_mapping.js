import models from '../models/index.js';

const listAll = () => {
  return models.ExpenseMapping.findAll({
    order: [
      [ 'kind', 'ASC' ],
      [ 'displayOrder', 'ASC' ]
    ]
  });
};

export default {
  // 支払先/出金元の選択は一般従業員にも必要なため、取得は認証済み全ユーザー
  // （書き込み権限は libs/permission.js で会計権限に制限）
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const mappings = await listAll();
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
  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
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
            await models.ExpenseMapping.create(value);
          }
        }
      }
      const mappings = await listAll();
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
