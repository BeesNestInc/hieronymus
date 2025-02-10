import express from 'express';
const router = express.Router();
import fs from 'fs';

import journal from './api_journal.js';
import ledger from './api_ledger.js';
import account from './api_account.js';
import sub_account from './api_sub_account.js';
import remaining from './api_remaining.js';
import trial_balance from './api_trial_balance.js';
import customer from './api_customer.js';
import voucher from './api_voucher.js';
import user from './api_user.js';
import transaction from './api_transaction_document.js';
import admin from './api_admin.js';
import changes from './api_changes.js';
import setup from './api_setup.js';
import item from './api_item.js';
import member from './api_member.js';
import document from './api_document.js';
import task from './api_task.js';

import cross_slip from './api_cross_slip.js';
import cross_slip_detail from './api_cross_slip_detail.js';

import models from '../models/index.js';
const Op = models.Sequelize.Op;
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const VERSION = pkg.version;

router.post('/admin/backup', admin.backup);
router.post('/admin/restore', admin.restore);
router.get('/admin/backups', admin.backups);
router.delete('/admin/backup/:date', admin.delete);

router.get('/user', user.get);
router.get('/user/:id', user.get);
router.put('/user/password', user.password);
router.post('/user/login', user.login);
router.post('/user/signup', user.signup);
router.put('/user/:id', user.update);
router.delete('/user/:id', user.delete);
router.get('/users/member', user.members);
router.get('/users', user.list);

router.get('/transaction', transaction.get);
router.get('/transaction/:id', transaction.get);
router.post('/transaction', transaction.post);
router.put('/transaction', transaction.update);
router.put('/transaction/:id', transaction.update);
router.delete('/transaction/:id', transaction.delete);

router.get('/task', task.get);
router.get('/task/:id', task.get);
router.post('/task', task.post);
router.put('/task', task.update);
router.put('/task/:id', task.update);
router.delete('/task/:id', task.delete);

router.get('/journal/:year/:month', journal.get);

router.get('/ledger/:term/:account', ledger.get);
router.get('/ledger/:term/:account/:sub_account', ledger.get);

router.get('/changes/:term/:account', changes.get);
router.get('/changes/:term/:account/:sub_account', changes.get);

router.get('/remaining/:term/:account', remaining.get);
router.get('/remaining/:term/:account/:sub_account', remaining.get);

router.get('/accounts', account.all);
router.get('/accounts/:term', account.all2);
router.get('/account/:code', account.get);
router.get('/account-class/:id', account.get_class);
router.put('/account/:term', account.update);
router.post('/account/:term', account.post);

router.put('/sub_account/:term', sub_account.update);
router.post('/sub_account/:term', sub_account.post);

router.get('/cross_slip/:year/:month/:no', cross_slip.get);
router.get('/cross_slips/:type', cross_slip.list);
router.post('/cross_slip', cross_slip.post);
router.put('/cross_slip', cross_slip.update);
router.put('/cross_slip/approve', cross_slip.approve);
router.delete('/cross_slip', cross_slip.delete);

router.get('/cross-slip-detail/:id', cross_slip_detail.get);
router.put('/cross-slip-detail', cross_slip_detail.update);

router.get('/trial-balance/:term', trial_balance.get);
router.get('/trial-balance/:term/:lastdate', trial_balance.get);

router.get('/customer', customer.get);
router.get('/customer/:id', customer.get);
router.post('/customer', customer.post);
router.put('/customer', customer.update);
router.put('/customer/:id', customer.update);
router.delete('/customer', customer.delete);
router.delete('/customer/:id', customer.delete);

router.get('/voucher', voucher.get);
router.get('/voucher/:id', voucher.get);
router.post('/voucher', voucher.post);
router.post('/voucher/upload/:id',voucher.upload);
router.post('/voucher/upload',voucher.upload);
router.put('/voucher', voucher.update);
router.put('/voucher/bind', voucher.bind);
router.put('/voucher/:id', voucher.update);
router.delete('/voucher', voucher.delete);
router.delete('/voucher/file', voucher.deleteFile);
router.delete('/voucher/:id', voucher.delete);
router.get('/voucher/files/:id', voucher.files);

router.get('/item/classes', item.classes);
router.get('/item', item.get);
router.get('/item/:id', item.get);
router.post('/item', item.post);
router.post('/item/upload/:id', item.upload);
router.post('/item/upload',item.upload);
router.put('/item', item.update);
router.put('/item/bind', item.bind);
router.put('/item/:id', item.update);
router.delete('/item', item.delete);
router.delete('/item/file', item.deleteFile);
router.delete('/item/:id', item.delete);
router.get('/item/files/:id', item.files);

router.get('/document', document.get);
router.get('/document/:id', document.get);
router.get('/document/file/:id', document.file);
router.post('/document', document.post);
router.post('/document/upload/:id', document.upload);
router.post('/document/upload', document.upload);
router.put('/document', document.update);
router.put('/document/bind', document.bind);
router.put('/document/:id', document.update);
router.delete('/document', document.delete);
router.delete('/document/file', document.deleteFile);
router.delete('/document/:id', document.delete);
router.get('/document/files/:id', document.files);

router.get('/member/classes', member.classes);
router.get('/member', member.get);
router.get('/member/:id', member.get);
router.post('/member', member.post);
router.put('/member', member.update);
router.put('/member/:id', member.update);
router.delete('/member', member.delete);
router.delete('/member/:id', member.delete);

router.get('/term/:year/:month', async (req, res, next) => {
	let year = req.params.year;
	let month = req.params.month;
	let fy = await models.FiscalYear.findOne({
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
	});
	//console.log(fy);
	res.json(fy);
});

router.get('/term/:term', async (req, res, next) => {
	let term = parseInt(req.params.term);
	//console.log({term});
	if	( term > 0 )	{
		let fy = await models.FiscalYear.findOne({
			where: {
				term: term
			}
		});
		res.json(fy);
	}
});
router.put('/term/:id', async(req, res, next) => {
  let id = parseInt(req.params.id);
  //console.log({id});
  let fy = await models.FiscalYear.findByPk(id);
  fy.taxIncluded = req.body.taxIncluded;
  fy.save();
  res.json({
    code: 0
  })
})
router.get('/term', async (req, res, next) => {
	models.FiscalYear.findAll({
    order: [
      ['term', 'ASC']
    ]
  }).then((lines) => {
		res.json(lines);
	});
});

router.post('/setup', setup)

router.get('/version', async (req, res, next) => {
	res.json({version: VERSION});
});

export default router;
