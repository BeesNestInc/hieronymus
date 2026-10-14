import models from '../models/index.js';
import fs from 'fs';
const Op = models.Sequelize.Op;
import Mime from 'mime';
import {numeric} from '../libs/utils.js';
import * as taxcalc from '../libs/tax-calc.js';
import {isLocked, findFiscalYearForDate} from '../libs/fiscal-lock.js';

const LOCK_MESSAGE = 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。';

const rejectIfVoucherLocked = async (issueDate, res) => {
  const fy = await findFiscalYearForDate(issueDate ? new Date(issueDate) : new Date());
  if ( fy && isLocked(fy) ) {
    res.status(423).json({code: -423, message: LOCK_MESSAGE, term: fy.term});
    return true;
  }
  return false;
};

const prepareVoucher = async (body, res) => {
  if ( !body.companyId ) {
    res.status(422).json({code: -2, message: '相手先が未入力もしくは、取引先に存在しない相手先が入力されました。'});
    return false;
  }
  const company = await models.Company.findByPk(body.companyId);
  if ( !company ) {
    res.status(422).json({code: -2, message: '相手先が未入力もしくは、取引先に存在しない相手先が入力されました。'});
    return false;
  }
  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const ctx = await taxcalc.loadTaxContext(issueDate.getFullYear(), issueDate.getMonth() + 1);
  if ( ctx.fy && isLocked(ctx.fy) ) {
    res.status(423).json({code: -423, message: LOCK_MESSAGE, term: ctx.fy.term});
    return false;
  }
  if ( body.amount ) {
    body.amount = numeric(body.amount);
    body.tax = body.taxRuleId
      ? taxcalc.computeVoucherTax(body.amount, body.taxRuleId, ctx)
      : 0;
  }
  return true;
}

const getFiles = async (id) => {
  let files = await models.VoucherFile.findAll({
    where: {
      voucherId: id
    },
    attributes: {
      exclude: ['body']
    }
  });
  for	( let i = 0 ; i < files.length; i += 1 )	{
    if	( files[i].mimeType.match(/^image\//) )	{
      let file = await models.VoucherFile.findOne({
          where: {
            id: files[i].id
          },
          attributes: {
            include: ['body']
          }
        });
      files[i].body = file.body.toString('base64');
    } else {
      files[i].body = '';
    }
  }
  return	(files);
}

export default {
  get: async (req, res, next) => {
    let id =  req.params.id;
    //console.log('/api/voucher/', id);
    let include = [
    	{
        model: models.Company,
        as: 'company'
      },{
        model: models.User,
        as: 'updateUser'
      },{
        model: models.VoucherClass,
        as: 'voucherClass'
      }, {
        model: models.TaxRule,
        as: 'taxRule'
      }
    ];

    
    if	( !id )	{
      let	order;
      let where;
      console.log('query', req.query);
      if	( req.query.order )	{
        order = req.query.order;
      } else {
        order = [
          [ "issueDate", "ASC" ]
        ]
      }
      if	( req.query.expenseUnlinked === '1' )	{
        // 経費精算の証憑候補用: どこにも紐付いていない証憑に絞り込む。
        // 浮遊証憑はどの期・月の精算にも使い得るため、日付では絞らない。
        where = {
          expenseReportId: { [Op.eq]: null }
        };
      } else	{
      if	( req.query.date )	{
        // YYYY-M-D / YYYY-MM-DD のどちらも受け付け、DATEONLY列との比較は
        // 文字列(YYYY-MM-DD)で行う。new Date()でDateオブジェクト化すると
        // ゼロパディング有無でUTC/ローカル解釈が変わり9時間ずれるため。
        const m = String(req.query.date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        const dateStr = m
          ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
          : String(req.query.date);
        where = {
          [Op.or]: [
            {
              issueDate: {
                [Op.eq]: dateStr
              }
            },
            {
              paymentDate: {
                [Op.eq]: dateStr
              }
            }
          ]
        };
      } else
      if	( req.query.month )	{
        let ymd = req.query.month.split('-');
        let fromDate = new Date(parseInt(ymd[0]), parseInt(ymd[1]) - 1, 1);
        let toDate = new Date(parseInt(ymd[0]), parseInt(ymd[1]), 1);
        //console.log('month', fromDate, toDate);
        where = {
          [Op.or]: [
            {
              [Op.and]: [
                {
                  issueDate: {
                    [Op.gte]: fromDate
                  }
                }, {
                  issueDate: {
                    [Op.lt]: toDate
                  }
                }
              ]
            },
            {
              [Op.and]: [
                {
                  paymentDate: {
                    [Op.gte]: fromDate
                  }
                }, {
                  paymentDate: {
                    [Op.lt]: toDate
                  }
                }
              ]
            }
          ]
        };
      } else if ( !req.query.term && !req.session.term ) {
        return res.status(400).json({
          code: -2,
          message: '会計年度(term)が未設定です。/api/voucher には ?month=YYYY-MM か ?date=YYYY-MM-DD か ?term=数値 を指定してください'
        });
      } else {
        // ?term= での指定を優先する（セッションのtermが未確定でも使えるように）
        const term = req.query.term ? parseInt(req.query.term) : req.session.term;
        let fy = await models.FiscalYear.findOne({
          where: {
            term: term
          }
        });
        where = {
            [Op.and]: [
              {
                issueDate: {
                  [Op.gte]: new Date(fy.startDate)
                }
              },
              {
                issueDate: {
                  [Op.lte]: new Date(fy.endDate)
                }
              }
            ]
          };
      }
      }
      if	( req.query.type )	{
        let type = parseInt(req.query.type);
        if	( type > 0 )	{
        	where = {
          	[Op.and]: [
            	where,
            	{
              	voucherClassId: type
            	}
          	]
        	};
        }
      }
      if	( req.query.company )	{
        where = {
          [Op.and]: [
            where,
            {
              companyId: parseInt(req.query.company)
            }
          ]
        };
      }
      if	( req.query.expenseUnlinked === '1' )	{
        // 経費精算の証憑候補用: どこにも紐付いていない証憑だけに絞り込む
        // （精算書の明細・パイル、伝票の両方を除外する）
        where = {
          [Op.and]: [
            where,
            models.Sequelize.literal(`NOT EXISTS (SELECT 1 FROM "ExpenseReportLines" WHERE "ExpenseReportLines"."voucherId" = "Voucher"."id")`),
            models.Sequelize.literal(`NOT EXISTS (SELECT 1 FROM "CrossSlipDetails" WHERE "CrossSlipDetails"."debitVoucherId" = "Voucher"."id" OR "CrossSlipDetails"."creditVoucherId" = "Voucher"."id")`)
          ]
        };
      }
      if	( req.query.upper )	{
        if	( req.query.lower )	{
          where = {
            [Op.and]: [
              where,
              {
                amount: {
                  [Op.gte]: parseInt(req.query.lower)
                }
              },
              {
                amount: {
                  [Op.lte]: parseInt(req.query.upper)
                }
              }
            ]
          };
        } else {
          where = {
            [Op.and]: [
              where,
              {
                amount: {
                  [Op.lte]: parseInt(req.query.upper)
                }
              }
            ]
          };
        }
      } else
      if	( req.query.lower )	{
        where = {
          [Op.and]: [
            where,
            {
              amount: {
                [Op.gte]: parseInt(req.query.lower)
              }
            }
          ]
        };

      }
      models.Voucher.findAll({
        where: where,
        order: order,
        include: include,
        distinct: true
      }).then( async(_vouchers) => {
        //console.log('_vouchers', _vouchers);
        let vouchers = [];
        for	( let i = 0; i < _vouchers.length ; i += 1 )	{
          let voucher = _vouchers[i].dataValues;
          let files = await getFiles(voucher.id);
          voucher.files = files;
          let details = await models.CrossSlipDetail.findAll({
            where: {
              [Op.or]: [
                {
                  debitVoucherId: voucher.id
                }, {
                  creditVoucherId: voucher.id
                }
              ]
            },
            include: [
              {
                model: models.CrossSlip,
                as: 'crossSlip'
              }
            ]
          });
          voucher.details = details;

          vouchers.push(voucher);
        }
        res.json({
          code: 0,
          vouchers: vouchers
      	});
      }).catch((e) => next(e));
    } else {
      models.Voucher.findOne({
        where: {
          id: id
        },
        include: include
      }).then(async(_voucher) => {
        let voucher = _voucher.dataValues;
        let details = await models.CrossSlipDetail.findAll({
          where: {
            [Op.or]: [
              {
                debitVoucherId: voucher.id
              }, {
                creditVoucherId: voucher.id
              }
            ]
          },
          include: [
            {
              model: models.CrossSlip,
              as: 'crossSlip'
            }
          ]
        });
        voucher.details = details;
        res.json({
          code: 0,
          voucher: voucher
        });
      }).catch((e) => next(e));
    }
  },
  post: async(req, res, next) => {
    let body = req.body;
    body.createdBy = req.session.user.id;
    body.updatedBy = req.session.user.id;
    const ok = await prepareVoucher(body, res);
    if ( !ok ) return;
    models.Voucher.create(body).then((voucher) => {
      res.json({
        code: 0,
        voucher: voucher
      });
    }).catch((e) => {
      res.json({
        code: -1
      });
    });
  },
  update: async(req, res, next) => {
    let body = req.body;
    body.updatedBy = req.session.user.id;
    let id = req.params.id ? req.params.id : body.id;

    const ok = await prepareVoucher(body, res);
    if ( !ok ) return;

    let voucher = await models.Voucher.findByPk(id)
    if	( voucher )	{
      if  ( !req.session.user.accounting && voucher.createdBy !== req.session.user.id )  {
        res.json({code: -10, message: 'permission denied'});
        return;
      }
      if ( await rejectIfVoucherLocked(voucher.issueDate, res) ) {
        return;
      }
      voucher.set(body);
      voucher.save().then(() => {
        res.json({
          voucher: voucher
      	});
      }).catch((e) => {
        res.json({
          code: -1
        });
      });
    }
  },
  delete: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    models.Voucher.findByPk(id).then(async (voucher) => {
      if  ( voucher )  {
        if  ( !req.session.user.accounting && voucher.createdBy !== req.session.user.id )  {
          res.json({code: -10, message: 'permission denied'});
          return;
        }
        if ( await rejectIfVoucherLocked(voucher.issueDate, res) ) {
          return;
        }
        voucher.destroy().then(() => {
          res.json({
            code: 0});
        }).catch((err) => {
          res.json({
            code: -2
          })
        });
      }
    }).catch((err) => {
      res.json({
        code: -1
      })
    });
  },
  upload: async (req, res, next) => {
    let voucher_id = req.params.id ? parseInt(req.params.id): null;
    if ( voucher_id ) {
      const voucher = await models.Voucher.findByPk(voucher_id);
      if ( voucher && await rejectIfVoucherLocked(voucher.issueDate, res) ) {
        return;
      }
    }
    let name = req.files.file.name;
    let tmp_name = req.files.file.path;
    let body = fs.readFileSync(tmp_name);
    let	mime_type = Mime.getType(tmp_name);
    models.VoucherFile.create({
      name: name,
      voucherId: voucher_id,
      mimeType: mime_type,
      body: body
    }).then	((ret) => {
      ret.body = ret.body.toString('base64');
      res.json({
            code: 0,
            file: ret
          });
    }).catch((err) => {
      res.json({
            code: -1
          });
    });
  },
  files: async (req, res, next) => {
    let id =  parseInt(req.params.id);
    console.log('/api/voucher/files', id);
    if	( id )	{
      let files = await getFiles(id);
      res.json(files);
    }
  },
  bind: (req, res, next) => {
    let	body = req.body;
    models.VoucherFile.findByPk(body.id).then(async (file) => {
      if ( body.voucherId ) {
        const voucher = await models.Voucher.findByPk(body.voucherId);
        if ( voucher && await rejectIfVoucherLocked(voucher.issueDate, res) ) {
          return;
        }
      }
      file.voucherId = body.voucherId;
      file.save().then(() => {
        res.json({
          code: 0
        });
      }).catch((e) => {
        console.log('error', e);
        res.json({
          code: -1
        });
      })
    })
  },
  deleteFile: (req, res, next) => {
    let id = parseInt(req.body.id);
    console.log('deleteFile', id);
    models.VoucherFile.findByPk(id).then(async (file) => {
      if ( file && file.voucherId ) {
        const voucher = await models.Voucher.findByPk(file.voucherId);
        if ( voucher && await rejectIfVoucherLocked(voucher.issueDate, res) ) {
          return;
        }
      }
      file.destroy().then(() => {
        res.json({
          code: 0
        });
      }).catch((e) => {
        res.json({
          code: -1
        });
      });
    }).catch((e) => {
      res.json({
        code: -1
      })
    });
  },
  classesGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.VoucherClass.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((classes) => {
      res.json({
        values: classes
      })
    })
  },
  classesPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let kinds = req.body.values;
    for ( const kind of kinds ) {
      if  ( kind.id ) {
        let result = await models.VoucherClass.findByPk(kind.id);
        if  ( !kind.name )  {
          await result.destroy();
        } else {
          result.set(kind);
          await result.save();
        }
      } else {
        await models.VoucherClass.create(kind);
      }
    }
    models.VoucherClass.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((kinds) => {
      res.json({
        values: kinds
      })
    })
  }
};
