import models from '../models/index.js';
const Op = models.Sequelize.Op;
import Accounts from '../libs/accounts.js';

export default {
  get: async (req, res, next) => {
    let account_code = req.params.code;

    let account = await models.Account.findOne({
      where: {
        accountCode: account_code
      },
      include: [{
        model: models.SubAccount,
        order: ['subAccountId', 'ASC'],
        as: 'subAccounts'
      }],
    });
    //console.log(account);
    res.json(account);
  },
  get_class: (req, res, next) => {
    let id = req.params.id;
    models.AccountClass.findOne({
      where: {
        id: id
      }
    }).then((data) => {
      console.log({data});
      res.json(data);
    });
  },
  post_class: async (req, res, next) => {
    let major = (req.body.major || '').trim();
    let middle = (req.body.middle || '').trim();
    let minor = (req.body.minor || '').trim();
    let field = parseInt(req.body.field, 10);
    let adding = parseInt(req.body.adding, 10);
    if (!major || !middle || !minor || isNaN(field) || isNaN(adding)) {
      res.status(400).json({ code: -1, message: '大分類・中分類・小分類・field・addingは必須です' });
      return;
    }
    let dup = await models.AccountClass.findOne({
      where: { field: field, adding: adding }
    });
    if (dup) {
      res.status(409).json({ code: -2, message: '同じfield・addingの科目クラスが既に存在します' });
      return;
    }
    let rec = await models.AccountClass.create({
      major: major,
      middle: middle,
      minor: minor,
      field: field,
      adding: adding
    });
    res.json({ id: rec.id });
  },
  update_class: async (req, res, next) => {
    let id = req.params.id;
    let rec = await models.AccountClass.findOne({ where: { id: id } });
    if (!rec) {
      res.status(404).json({ code: -3, message: '科目クラスが見つかりません' });
      return;
    }
    // field/addingは既存科目コードとの整合のため編集不可とし、名称のみ更新する
    if (req.body.major !== undefined) rec.major = String(req.body.major).trim();
    if (req.body.middle !== undefined) rec.middle = String(req.body.middle).trim();
    if (req.body.minor !== undefined) rec.minor = String(req.body.minor).trim();
    if (!rec.major || !rec.middle || !rec.minor) {
      res.status(400).json({ code: -1, message: '大分類・中分類・小分類は必須です' });
      return;
    }
    await rec.save();
    res.json({ code: 0 });
  },
  post: async(req, res, next) => {
    let term = parseInt(req.params.term);
    let new_account = await models.Account.create({
      name: req.body.name,
      key: req.body.key,
      accountClassId: req.body.klass_id,
      accountCode: req.body.code,
      taxClass: req.body.tax_class,
      subAccountCount: 0
    });
    await models.AccountRemaining.create({
      term: term,
      accountId: new_account.id,
      debit: req.body.debit,
      credit: req.body.credit,
      balance: req.body.balance
    });
    res.json({
      accountCode: new_account.accountCode
    })
  },
  update: async(req, res, next) => {
    let sub_code = req.body.sub_code;
    let term = parseInt(req.params.term);
    let account = await models.Account.findOne({
      where: {
        accountCode: req.body.code
      }
    });
    account.key = req.body.key;
    account.name = req.body.name;
    account.taxClass = req.body.tax_class;
    account.save();
    let rem = await models.AccountRemaining.findOne({
      where: {
        [Op.and]: {
          term: term,
          accountId: account.id
        }
      }
    });
    if ( !rem ) {
      rem = new models.AccountRemaining({
        term: term,
        accountId: account.id
      });
    }
    rem.debit = req.body.debit;
    rem.credit = req.body.credit;
    rem.balance = req.body.balance;
    rem.save();
    res.json({
      code: 0
    });
  },
  all: (req, res, next) => {
    Accounts.all().then((lines) => {
      res.json(lines);
    });
  },
  all2: async (req, res, next) => {
    Accounts.all2(req.params.term).then((lines) => {
      res.json(lines);
    });
  },
  all3: async (req, res, next) => {
    Accounts.all3(req.params.term).then((lines) => {
      res.json(lines);
    });
  },
  all4: async (req, res, next) => {
    Accounts.all4(req.params.term).then((lines) => {
      res.json(lines);
    });
  }
}
