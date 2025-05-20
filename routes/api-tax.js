import models from '../models/index.js';
const Op = models.Sequelize.Op;

export default {
  get: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let result = {};
    switch  (req.query.type) {
      case  'active':
        result = await models.TaxRule.findAll({
          where: {
            [Op.and]: [
              {
                [Op.or]: [
                  { startDate: null },
                  { startDate: { [Op.lte]: req.query.date } }
                ]
              },
              { [Op.or]: [
                  { endDate: null },
                  { endDate: { [Op.gte]: req.query.date } }]
              }
            ]
          },
          order: [
            [ 'startDate', 'DESC']
          ]
        });
        break;
      default:
        result = await models.TaxRule.findAll({
          order: [
            [ 'displayOrder', 'ASC']
          ]
        });
        break;
    }
    res.json({
      values: result
    });
  },
  put: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let taxRules = req.body.values;
    for ( const taxRule of taxRules ) {
      if  ( taxRule.id ) {
        let result = await models.TaxRule.findByPk(taxRule.id);
        if  ( !taxRule.label )  {
          await result.destroy();
        } else {
          result.set(taxRule);
          await result.save();
        }
      } else {
        await models.TaxRule.create(taxRule);
      }
    }
    models.TaxRule.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((taxRule) => {
      res.json({
        values: taxRule
      })
    })
  }
}