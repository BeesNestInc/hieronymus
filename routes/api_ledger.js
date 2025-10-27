import models from '../models/index.js';
const Op = models.Sequelize.Op;
import Accounts from '../libs/accounts.js';

const	get_details = async (fy, account, sub_account) => {
  //console.log({account});
  //console.log({sub_account});
  let ledger = [];
  const endDate = new Date(fy.endDate);
  for ( let mon = new Date(fy.startDate); mon <= endDate; mon.setMonth(mon.getMonth() + 1) ) {
    let where;

    if (( sub_account ) &&
      ( sub_account > 0 )) {
      where = {
        [Op.and]: {
          [Op.or]: [
            {
              debitAccount: account,
              debitSubAccount: sub_account
            },
            {
              creditAccount: account,
              creditSubAccount: sub_account
            }
          ],
          '$crossSlip.year$': mon.getFullYear(),
          '$crossSlip.month$': mon.getMonth() + 1
        }
      };
    } else {
      where = {
          [Op.and]: {
            '$crossSlip.year$': mon.getFullYear(),
            '$crossSlip.month$': mon.getMonth() + 1,
            [Op.or]: {
              debitAccount: account,
              creditAccount: account
            }
          }
        };
    }
    //console.log('where', where);

    let details = await models.CrossSlipDetail.findAll({
      where: where,
      include: [
        {
          model: models.CrossSlip,
          as: 'crossSlip',
        },
        {
          model: models.Voucher,
          required: false,
          as: 'debitVoucher',
          include: [{
            model: models.VoucherFile,
            as: 'files'
          }]
        },
        {
          model: models.Voucher,
          required: false,
          as: 'creditVoucher',
          include: [{
            model: models.VoucherFile,
            as: 'files'
          }]
        }, {
          model: models.TaxRule,
          as: 'debitTaxRule'
        }, {
          model: models.TaxRule,
          as: 'creditTaxRule'
        }, {
          model: models.Project,
          as: 'projectData'
        }
      ],
      order: [
        models.sequelize.literal('"crossSlip"."year", "crossSlip"."month", "crossSlip"."day", "crossSlip"."no", "CrossSlipDetail"."lineNo" ASC')
      ]
    });
    for ( let i = 0; i < details.length; i ++ ) {
      if  ( details[i].crossSlip.approvedAt ) {
        ledger.push(details[i]);
      }
    }
  }
  return	(ledger)
}

export default {
  get: (req, res, next) => {
    let term =  parseInt(req.params.term);
    let account = req.params.account;
    let sub_account = parseInt(req.params.sub_account);
    //console.log('/api/ledger/', term, account, sub_account);
    //console.log(term);
    models.FiscalYear.findOne({
      where: {
        term: term
      }
    }).then((fy) => {
      get_details(fy, account, sub_account).then((ledger)=> {
        res.json(ledger);
      })
    });
  },
};
