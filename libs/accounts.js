import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {make_klass} from  './parse_account_code.js';
import * as utils from './utils.js';

export default class {
  static accounts;

  static async  all () {
    let accounts = await models.Account.findAll({
      order: [
        ['accountCode']
      ], 
    });
    let lines = [];
    for ( let i = 0; i < accounts.length; i ++ ) {
      let acc = accounts[i];
      if ( acc.subAccountCount > 0 ) {
        let sub_lines = [];
        let subs = await models.SubAccount.findAll({
          where: {
            accountId: acc.id
          },
          order: [
            ['subAccountCode']
          ]
        });
        for ( let j = 0; j < subs.length; j ++ ) {
          let sub = subs[j];
          sub_lines.push({
            key: sub.key,
            name: sub.name,
            code: sub.subAccountCode,
            taxClass: sub.taxClass
          });
        }
        lines.push({
          key: acc.key,
           name: acc.name,
          code: acc.accountCode,
          taxClass: acc.taxClass,
          subAccounts: sub_lines
        });
      } else {
        lines.push({
          key: acc.key,
          name: acc.name,
          code: acc.accountCode,
          taxClass: acc.taxClass
        });
      }
    }
    this.accounts = lines;
    return (lines);
  }
  static async all3(term) {
    // 1. 残高取得関数
    const getRemaining = async (model, key, field) => {
      const rem = await model.findOne({
        where: {
          [Op.and]: {
            term,
            [field]: key
          }
        }
      });
      return {
        debit: rem?.debit || 0,
        credit: rem?.credit || 0,
        balance: rem?.balance || 0
      };
    };
    
    // 2. データ取得
    const accountClasses = await models.AccountClass.findAll({
      order: [
        ['field', 'ASC'],
        ['adding', 'ASC'],
        [{ model: models.Account, as: 'accounts' }, 'accountCode', 'ASC'],
        [
          { model: models.Account, as: 'accounts' },
          { model: models.SubAccount, as: 'subAccounts' },
          'subAccountCode',
          'ASC'
        ]
      ],
      include: [
        {
          model: models.Account,
          as: 'accounts',
          include: [
            {
              model: models.SubAccount,
              as: 'subAccounts'
            }
          ]
        }
      ]
    });
    
    // 3. 出力作成
    const lines = [];
    
    for (const acl of accountClasses) {
      const klassInfo = {
        major_name: acl.major,
        middle_name: acl.middle,
        minor_name: acl.minor,
        acl_id: acl.id,
        acl_code: make_klass(acl.field, acl.adding)
      };
    
      if (!acl.accounts || acl.accounts.length === 0) {
        lines.push(klassInfo);
        continue;
      }
    
      for (const acc of acl.accounts) {
        const accRem = await getRemaining(models.AccountRemaining, acc.id, 'accountId');
    
        if (acc.subAccounts && acc.subAccounts.length > 0) {
          const sub_lines = [];
    
          for (const suba of acc.subAccounts) {
            const subRem = await getRemaining(models.SubAccountRemaining, suba.id, 'subAccountId');
    
            sub_lines.push({
              id: suba.id,
              key: suba.key,
              name: suba.name,
              code: suba.subAccountCode,
              taxClass: suba.taxClass,
              ...subRem
            });
          }
    
          lines.push({
            ...klassInfo,
            id: acc.id,
            key: acc.key,
            name: acc.name,
            code: acc.accountCode,
            taxClass: acc.taxClass,
            subAccounts: sub_lines,
            ...accRem
          });
        } else {
          lines.push({
            ...klassInfo,
            id: acc.id,
            key: acc.key,
            name: acc.name,
            code: acc.accountCode,
            taxClass: acc.taxClass,
            ...accRem
          });
        }
      }
    }
    
    this.accounts = lines;
    return lines;
  }
    
  static async all2 (term) {
    let accounts = await models.Account.findAll({
      order: [
        ['accountCode']
      ],
      include: [{
        model: models.SubAccount,
        order: ['subAccountCode', 'ASC'],
        as: 'subAccounts'
      }, {
        model: models.AccountClass,
        as: 'accountClass'
      }]
    });
    //console.log(JSON.stringify(accounts,null,2));
    let lines = [];
    for ( let i = 0; i < accounts.length; i ++ ) {
      let acc = accounts[i];
      if ( acc.subAccounts.length > 0 ) {
        let sub_lines = [];
        for ( let j = 0; j < acc.subAccounts.length; j ++ ) {
          let suba = acc.subAccounts[j];
          let rem = await models.SubAccountRemaining.findOne({
            where: {
              [Op.and]: {
                term: term,
                subAccountId: suba.id
              }
            }
          })
          sub_lines.push({
            id: suba.id,
            key: suba.key,
            name: suba.name,
            code: suba.subAccountCode,
            taxClass: suba.taxClass,
            debit: rem ? rem.debit : 0,
            credit: rem ? rem.credit : 0,
            balance: rem ? rem.balance :0
          });
        }
        let rem = await models.AccountRemaining.findOne({
          where: {
            [Op.and]: {
              term: term,
              accountId: acc.id
            }
          }
        });
        lines.push({
          id: acc.id,
          major_name: acc.accountClass.major,
          middle_name: acc.accountClass.middle,
          minor_name: acc.accountClass.minor,
          key: acc.key,
          name: acc.name,
          code: acc.accountCode,
          taxClass: acc.taxClass,
          subAccounts: sub_lines,
          debit: rem ? rem.debit : 0,
          credit: rem ? rem.credit : 0,
          balance: rem ? rem.balance :0
        });
      } else {
        let rem = await models.AccountRemaining.findOne({
          where: {
            [Op.and]: {
              term: term,
              accountId: acc.id
            }
          }
        });
        //console.log('remaining', rem);
        lines.push({
          id: acc.id,
          major_name: acc.accountClass.major,
          middle_name: acc.accountClass.middle,
          minor_name: acc.accountClass.minor,
          key: acc.key,
          name: acc.name,
          code: acc.accountCode,
          taxClass: acc.taxClass,
          debit: rem ? rem.debit : 0,
          credit: rem ? rem.credit : 0,
          balance: rem ? rem.balance :0
        });
      }
    }
    //console.log(JSON.stringify(lines, null, 2))
    this.accounts = lines;
    return (lines);
  }
  static find_account(code) {
    let account;
    if ( code ) {
      account = { name: '', key: ''};
      for ( let i = 0; i < this.accounts.length; i ++ ) {
        if ( this.accounts[i].code === code ) {
          account = this.accounts[i];
          break;
        }
      }
    } else {
      account = { name: '諸口', key: ''};
    }
    return account;
  }
  static	find_account_by_name(name)	{
    let account;
    if ( name ) {
      account = { name: '', key: ''};
      for ( let i = 0; i < this.accounts.length; i ++ ) {
        if ( this.accounts[i].name == name ) {
          account = this.accounts[i];
          break;
        }
      }
    } else {
      account = { name: '諸口', key: ''};
    }
    return account;
  }
  static find_sub_account(code, sub_code) {
    let sub_account = { name: ''};

    let account = this.find_account(code);
    
    if ( account.subAccounts ) {
      for ( let i = 0; i < account.subAccounts.length; i ++ ) {
        if ( account.subAccounts[i].code == sub_code ) {
          sub_account = account.subAccounts[i];
          break;
        }
      }
    }
    return sub_account;
  }
  static name(code) {
    return this.find_account(code).name;
  }
  static sub_name(code, sub_code) {
    return this.find_sub_account(code, sub_code).name;
  }
  static TAX_CLASS = utils.TAX_CLASS;
  static tax_class = utils.taxClass;
}