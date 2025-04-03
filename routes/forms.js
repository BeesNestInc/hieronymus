import express from 'express';
const router = express.Router();
import {is_authenticated} from '../libs/user.js';
import explanatory_journal from '../forms/explanatory_journal.js';
import general_ledger from '../forms/general_ledger.js';
import subsidiary_ledger from '../forms/subsidiary_ledger.js';
import trial_balance from '../forms/trial_balance.js';
import closing from '../forms/closing.js';
import financial_statement from '../forms/financial_statement.js';
import models from '../models/index.js';
const Op = models.Sequelize.Op;
import path from 'path';
import company from '../config/company.js';

const __dirname = import.meta.dirname;

router.get('/explanatory_journal/:term', is_authenticated, (req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
        explanatory_journal(parseInt(req.params.term)).then((buff) => {
            res.send(buff);
        });
	} else {
		res.redirect('/home');
	}
});
router.get('/general_ledger/:term', is_authenticated, (req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
        general_ledger(parseInt(req.params.term)).then((buff) => {
            res.send(buff);
        })
	} else {
		res.redirect('/home');
	}
});
router.get('/subsidiary_ledger/:term', is_authenticated, (req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
        subsidiary_ledger(parseInt(req.params.term)).then((buff) => {
            res.send(buff);
        })
	} else {
		res.redirect('/home');
	}
});
router.get('/trial_balance/:term', is_authenticated, (req, res, next) => {
	if (( req.session.user.accounting ) ||
      ( req.session.user.fiscalBrowsing )) {
    trial_balance(parseInt(req.params.term)).then((buff) => {
      res.send(buff);
    })
	} else {
		res.redirect('/home');
	}
});
router.get('/trial_balance/:term/:month', is_authenticated, (req, res, next) => {
	if (( req.session.user.accounting ) ||
      ( req.session.user.fiscalBrowsing )) {
    trial_balance(parseInt(req.params.term), req.params.month).then((buff) => {
      res.send(buff);
    })
	} else {
		res.redirect('/home');
	}
});

router.get('/closing/:term', is_authenticated,(req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
        closing(parseInt(req.params.term)).then(() => {
            res.redirect('/');
        })
	} else {
		res.redirect('/home');
	}
});
router.get('/financial_statement/:term', is_authenticated,(req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
        financial_statement(parseInt(req.params.term)).then((buff) => {
            res.send(buff);
        })
	} else {
		res.redirect('/home');
	}
});

/*
const form_transaction = async (req, res, next) => {
  if  ( req.session.user.accounting ) {
    let id = req.params.id;
    let transaction = await models.TransactionDocument.findByPk(id, {
      include: [
        {
          model: models.Customer,
          as: 'customer'
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
    res.render(`form/${req.params.form}.ejs`, {
      transaction: transaction,
      company: company
    });
  } else {
    res.redirect('/home');
  }
}
router.get('/transaction/:form/:id', is_authenticated, form_transaction);
*/

router.get('/transaction/:form/:id', is_authenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/form.html'));
})

export default router;