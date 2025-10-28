import express from 'express';
const router = express.Router();
import fs from 'fs';
import {is_authenticated} from '../libs/user.js';
import closing from '../forms/closing.js';

import journal from './api_journal.js';
import ledger from './api_ledger.js';
import account from './api_account.js';
import sub_account from './api_sub_account.js';
import remaining from './api_remaining.js';
import trial_balance from './api_trial_balance.js';
import company from './api_company.js';
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
import menu from './api_menu.js';
import term from './api-term.js';
import taxRule from './api-tax.js';
import project from './api-project.js';
import label from './api-label.js';
import projectSummary from './api-project-summary.js';

import cross_slip from './api_cross_slip.js';
import cross_slip_detail from './api_cross_slip_detail.js';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const VERSION = pkg.version;

router.post('/admin/backup', admin.backup);
router.post('/admin/restore', admin.restore);
router.get('/admin/backups', admin.backups);
router.get('/admin/backup/:date', admin.download);
router.post('/admin/upload', admin.upload);
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
router.get('/users/:id', user.list);

router.get('/transaction', transaction.get);
router.get('/transaction/kinds', transaction.kindsGet);
router.put('/transaction/kinds', transaction.kindsPut);
router.get('/transaction/:id', transaction.get);
router.post('/transaction', transaction.post);
router.put('/transaction', transaction.update);
router.post('/transaction/book/:id', transaction.book);
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

router.post('/closing/:term', is_authenticated,(req, res, next) => {
  if (( req.session.user.accounting ) ||
      ( req.session.user.fiscalBrowsing )) {
    closing(parseInt(req.params.term)).then(() => {
      res.json({ code: 0});
    })
  } else {
    res.json({ code: -10});
  }
})

router.get('/changes/:term/:account', changes.get);
router.get('/changes/:term/:account/:sub_account', changes.get);

router.get('/remaining/:term/:account', remaining.get);
router.get('/remaining/:term/:account/:sub_account', remaining.get);

router.get('/accounts', account.all);
router.get('/accounts2/:term', account.all2);
router.get('/accounts3/:term', account.all3);
router.get('/accounts4/:term', account.all4);
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

router.get('/trial-balance', trial_balance.get);
router.get('/trial-balance/:param', trial_balance.get);

router.get('/company', company.get);
router.get('/company/kinds', company.kindsGet);
router.put('/company/kinds', company.kindsPut);
router.get('/company/info', company.infoGet);
router.put('/company/info', company.infoPut);
router.get('/company/:id', company.get);
router.post('/company', company.post);
router.put('/company', company.update);
router.put('/company/:id', company.update);
router.delete('/company', company.delete);
router.delete('/company/:id', company.delete);

router.get('/voucher/classes', voucher.classesGet);
router.put('/voucher/classes', voucher.classesPut);
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

router.get('/item/classes', item.classesGet);
router.put('/item/classes', item.classesPut);
router.get('/item', item.get);
router.get('/item/:id', item.get);
router.post('/item', item.post);
router.put('/item', item.update);
router.put('/item/:id', item.update);
router.delete('/item', item.delete);
router.delete('/item/:id', item.delete);

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

router.get('/menu/templates', menu.getTemplates);
router.get('/menu/preview', menu.preview);
router.get('/menu/:id', menu.get);
router.get('/menu', menu.get);
router.post('/menu', menu.post);
router.put('/menu', menu.update);
router.put('/menu/:id', menu.update);
router.delete('/menu/:id', menu.delete);

router.get('/term/:year/:month', term.get);
router.get('/term/:term', term.get);
router.get('/term', term.get);
router.put('/term/:id', term.update);

router.get('/tax-rule/', taxRule.get);
router.put('/tax-rule/', taxRule.put);

router.get('/projects', project.get);
router.get('/project/:id', project.get);
router.post('/project', project.create);
router.put('/project/:id', project.update);
router.delete('/project/:id', project.delete);
router.get('/projects/:id/labels', project.getLabels);
router.put('/projects/:id/labels', project.updateLabels);

router.get('/labels', label.get);
router.post('/labels', label.create);
router.get('/labels/:id/accounts', label.getAccounts);
router.put('/labels/:id/accounts', label.updateAccounts);
router.delete('/labels/:id', label.delete);
router.put('/labels/:id', label.update);

router.get('/project-summary/:projectId', projectSummary.get);

router.post('/setup', setup)

router.get('/version', async (req, res, next) => {
  res.json({version: VERSION});
});

export default router;