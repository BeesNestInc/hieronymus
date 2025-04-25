import express from 'express';
const router = express.Router();
import {is_authenticated} from '../libs/user.js';
import explanatory_journal from '../forms/explanatory_journal.js';
import general_ledger from '../forms/general_ledger.js';
import subsidiary_ledger from '../forms/subsidiary_ledger.js';
import trial_balance from '../forms/trial_balance.js';
import financial_statement from '../forms/financial_statement.js';
import models from '../models/index.js';
const Op = models.Sequelize.Op;
import path from 'path';
import {print} from '../libs/print.js';
import initializeExplanatoryJournal from '../libs/init-explanatory-journal.js';
import initializeGeneralLedger from '../libs/init-general-ledger.js';
import initializeSubsidiaryLedger from '../libs/init-subsidiary-ledger.js';
import initializeTrialBalance from '../libs/init-trial-balance.js';
import initializeFinancialStatement from '../libs/init-financial-statement.js';
import myCompany from '../libs/my-company.js';

const __dirname = import.meta.dirname;

router.get('/explanatory_journal/:term', is_authenticated, async (req, res, next) => {
	if (( req.session.user.accounting ) ||
    	( req.session.user.fiscalBrowsing )) {
    if  ( req.query.format === 'pdf' )  {
      const company = await myCompany();
      const {fy, dates} = await initializeExplanatoryJournal(req.params.term);
      print('explanatory-journal', {
        fy: fy,
        dates: dates,
        company: company
      }).then((pdf) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdf);
      })
    } else
    if	( req.query.format === 'html' )	{
      res.sendFile(path.join(__dirname, '../views/form.html'));
    } else {
      explanatory_journal(parseInt(req.params.term)).then((buff) => {
        res.send(buff);
      });
    }
	} else {
		res.redirect('/home');
	}
});
router.get('/general_ledger/:term', is_authenticated, async (req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
    if  ( req.query.format === 'pdf' )  {
      const company = await myCompany();
      const {fy, accountPages, ledgerPages} = await initializeGeneralLedger(req.params.term);
      print('general-ledger', {
        fy: fy,
        company: company,
        accountPages: accountPages,
        ledgerPages: ledgerPages
      }).then((pdf) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdf);
      })
    } else
    if	( req.query.format === 'html')	{
      res.sendFile(path.join(__dirname, '../views/form.html'));
    } else {
      general_ledger(parseInt(req.params.term)).then((buff) => {
        res.send(buff);
      })
    }
	} else {
		res.redirect('/home');
	}
});
router.get('/subsidiary_ledger/:term', is_authenticated, async (req, res, next) => {
	if (( req.session.user.accounting ) ||
        ( req.session.user.fiscalBrowsing )) {
    if  ( req.query.format === 'pdf' )  {
      const company = await myCompany();
      const {fy, ledgerPages} = await initializeSubsidiaryLedger(req.params.term);
      print('subsidiary-ledger', {
        fy: fy,
        company: company,
        ledgerPages: ledgerPages
      }).then((pdf) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdf);
      })
    } else
    if	( req.query.format === 'html')	{
      res.sendFile(path.join(__dirname, '../views/form.html'));
    } else {
      subsidiary_ledger(parseInt(req.params.term)).then((buff) => {
        res.send(buff);
      })
    }
	} else {
		res.redirect('/home');
	}
});
router.get('/trial_balance/:term', is_authenticated, async (req, res, next) => {
	if (( req.session.user.accounting ) ||
      ( req.session.user.fiscalBrowsing )) {
    if  ( req.query.format === 'pdf' )  {
      const company = await myCompany();
      const {fy, assetPages, liabilitiesAndCapicalPages, incomeStatementPages} = await initializeTrialBalance(req.params.term);
      print('trial-balance', {
        fy: fy,
        company: company,
        assetPages: assetPages,
        liabilitiesAndCapicalPages: liabilitiesAndCapicalPages,
        incomeStatementPages: incomeStatementPages
      }).then((pdf) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdf);
      })
    } else
    if	( req.query.format === 'html')	{
      res.sendFile(path.join(__dirname, '../views/form.html'));
    } else {
      trial_balance(parseInt(req.params.term)).then((buff) => {
        res.send(buff);
      })
    }
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
router.get('/financial_statement/:term', is_authenticated, async (req, res, next) => {
	if (( req.session.user.accounting ) ||
      ( req.session.user.fiscalBrowsing )) {
    if  ( req.query.format === 'pdf' )  {
      const company = await myCompany();
      const {fy, bsLines, plOut, sgaPage, asset, liabilities, networth, sgaSum} = await initializeFinancialStatement(req.params.term);
      print('financial-statement', {
        fy: fy,
        company: company,
        bsLines: bsLines,
        plOut: plOut,
        sgaPage: sgaPage,
        sgaSum: sgaSum,
        asset: asset,
        liabilities: liabilities,
        networth: networth
      }).then((pdf) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdf);
      })
    } else
    if	( req.query.format === 'html')	{
      res.sendFile(path.join(__dirname, '../views/form.html'));
    } else {
      financial_statement(parseInt(req.params.term)).then((buff) => {
        res.send(buff);
      })
    }
	} else {
		res.redirect('/home');
	}
});

router.get('/transaction/:form/:id', is_authenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/form.html'));
})

export default router;