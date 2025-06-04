import fs from 'fs';
import models from '../models/index.js';
const Op = models.Sequelize.Op;

export const get = (req, res, next) => {
  if	( req.params.term )	{
    let term = parseInt(req.params.term);
    models.FiscalYear.findOne({
      where: {
        term: term
      }
    }).then((fy) => {
      res.json(fy);
    });
  } else
  if	(( req.params.year ) &&
       ( req.params.month ))	{
    let year = req.params.year;
    let month = req.params.month;
    models.FiscalYear.findOne({
      where: {
        [Op.and]: {
          startDate: {
            [Op.lte]: new Date(year, month - 1, 2)
          },
          endDate: {
            [Op.gte]: new Date(year, month - 1, 1)
          }
        }
      }
    }).then((fy) => {
      //console.log(fy);
      res.json(fy);
    });
  } else {
    models.FiscalYear.findAll({
      order: [
        ['term', 'ASC']
      ]
    }).then((lines) => {
      res.json(lines);
    });
  }
}

export const update = (req, res, next) => {
  let id = parseInt(req.params.id);
  //console.log({id});
  models.FiscalYear.findByPk(id).then((fy) => {
    fy.taxIncluded = req.body.taxIncluded;
    fy.save().then(() => {
      res.json({
        code: 0
      })
    });
  });
}

export default {
  get: get,
  update: update
}