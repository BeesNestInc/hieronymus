import fs from 'fs';
import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {isLocked} from '../libs/fiscal-lock.js';

const LOCK_MESSAGE = 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。';

export const get = (req, res, next) => {
  if	( req.params.term )	{
    let term = parseInt(req.params.term);
    if ( Number.isNaN(term) ) {
      // SPAにtermが渡っていない場合など。レコードが無いものとして返す
      res.json(null);
      return;
    }
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
    if ( !fy ) {
      res.status(404).json({ code: -1, message: 'record not found' });
      return;
    }
    if ( isLocked(fy) ) {
      res.status(423).json({ code: -423, message: LOCK_MESSAGE, term: fy.term });
      return;
    }
    fy.taxIncluded = req.body.taxIncluded;
    fy.save().then(() => {
      res.json({
        code: 0
      })
    });
  });
}

export const lock = async (req, res, next) => {
  let id = parseInt(req.params.id);
  const fy = await models.FiscalYear.findByPk(id);
  if ( !fy ) {
    res.status(404).json({ code: -1, message: 'record not found' });
    return;
  }
  fy.lockedAt = new Date();
  fy.lockedBy = req.session.user.id;
  await fy.save();
  res.json({
    code: 0,
    term: fy.term,
    lockedAt: fy.lockedAt
  });
}

export const unlock = async (req, res, next) => {
  let id = parseInt(req.params.id);
  const fy = await models.FiscalYear.findByPk(id);
  if ( !fy ) {
    res.status(404).json({ code: -1, message: 'record not found' });
    return;
  }
  fy.lockedAt = null;
  fy.lockedBy = null;
  await fy.save();
  res.json({
    code: 0,
    term: fy.term
  });
}

export default {
  get: get,
  update: update,
  lock: lock,
  unlock: unlock
}