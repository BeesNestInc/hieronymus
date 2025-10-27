import models from '../models/index.js';

export default {
  get: async (req, res, next) => {
    try {
      const labels = await models.Label.findAll({
              include: [{
                model: models.Account,
                as: 'accounts',
                through: {
                  attributes: ['summaryType'] // 中間テーブルからsummaryTypeを取得
                }
              }, {          model: models.Project,
          as: 'projects'
        }],
        order: [['name', 'ASC']]
      });
      console.log('[DEBUG] API response for labels:', JSON.stringify(labels, null, 2));
      res.json(labels);
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const newLabel = await models.Label.create(req.body);
      res.status(201).json(newLabel);
    } catch (err) {
      next(err);
    }
  },

  getAccounts: async (req, res, next) => {
    try {
      const label = await models.Label.findByPk(req.params.id);
      if (!label) {
        return res.status(404).send('Label not found');
      }
      const accounts = await label.getAccounts();
      res.json(accounts);
    } catch (err) {
      next(err);
    }
  },

  updateAccounts: async (req, res, next) => {
    try {
      const label = await models.Label.findByPk(req.params.id);
      if (!label) {
        return res.status(404).send('Label not found');
      }
      const labelId = label.id;
      const accounts = req.body.accounts || []; // オブジェクトの配列を受け取る

      // 既存の関連をすべて削除
      await models.LabelAccount.destroy({
        where: { labelId: labelId }
      });

      // 新しい関連をバルクインサート
      if (accounts.length > 0) {
        const newAssociations = accounts.map(acc => ({
          labelId: labelId,
          accountCode: acc.code,
          summaryType: acc.summaryType // summaryTypeも追加
        }));
        await models.LabelAccount.bulkCreate(newAssociations);
      }
      res.status(200).send();
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const label = await models.Label.findByPk(req.params.id);
      if (!label) {
        return res.status(404).send('Label not found');
      }
      await label.destroy();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const label = await models.Label.findByPk(req.params.id);
      if (!label) {
        return res.status(404).send('Label not found');
      }
      await label.update(req.body);
      res.json(label);
    } catch (err) {
      next(err);
    }
  },
};
