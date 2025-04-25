import express from 'express';
const router = express.Router();
import {is_authenticated} from '../libs/user.js';
import models from '../models/index.js';
const Op = models.Sequelize.Op;
import company from '../config/company.js';

const screen = (req, res, next) => {
    console.log('command', req.params.command);
    if ( req.session.user.accounting )	{
      res.render('index.spy', {
        term: req.session.term,
        user: req.session.user.name
      });
    } else {
      res.redirect('/home');
    }
}

const form_out = async (req, res, form) => {
  let id = req.params.id;
  let transaction = await models.TransactionDocument.findByPk(id, {
    include: [{
        model: models.Company,
        as: 'company'
      },
      {
        model: models.TransactionDetail,
        as: 'lines'
      },
      {
        model: models.User,
        as: 'handleUser',
        include: [
          {
            model: models.Member,
            as: 'member'
          }
        ]
      }
    ]
  });
  res.render(`form/${form}.ejs`, {
    transaction: transaction,
    company: company
  });
}

const form_transaction = async (req, res, next) => {
  if  ( req.session.user.accounting ) {
    await form_out(req, res, 'transaction');
  } else {
    res.redirect('/home');
  }
}
const form_estimate = async (req, res, next) => {
  if  ( req.session.user.accounting ) {
    await form_out(req, res, 'estimate');
  } else {
    res.redirect('/home');
  }
}

router.get('/transaction/:id', is_authenticated, form_transaction);
router.get('/estimate/:id', is_authenticated, form_estimate);
router.use('/:command', is_authenticated, screen);
router.use('/:command/:id', is_authenticated, screen);
router.use('/', is_authenticated, screen);

export default router;