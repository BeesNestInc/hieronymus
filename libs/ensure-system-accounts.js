// システム都合の仮入科目（x9xxxxx）を「なかったらINSERT」で揃える。
// - 入金仮 3900000（負債側。取込明細の入金行の相手方に仮置きする）
// - 出金仮 1900000（資産側。取込明細の出金行の相手方に仮置きする）
// 初期設定（accounts.csv の読み込み・触らない）とマイグレーションの両方から呼ぶ。
// 口座残高（AccountRemaining）と補助科目用の残高テーブルは未作成でも集計に影響ないが、
// 既存の期分はゼロ行として作っておく（元帳表示が残高行を前提としないための保険）。
import models from '../models/index.js';

const SYSTEM_ACCOUNTS = [
  {
    accountCode: '1900000',
    name: '出金仮',
    key: 'shukkinkari',
    taxClass: 0,
    accountClass: {
      major: '資産',
      middle: '流動資産',
      minor: '出金仮',
      // 科目コード1900000 = field(1) + adding(90) + 連番(0000)
      field: 1,
      adding: 90
    }
  },
  {
    accountCode: '3900000',
    name: '入金仮',
    key: 'nyukinkari',
    taxClass: 0,
    accountClass: {
      major: '負債',
      middle: '流動負債',
      minor: '入金仮',
      // 科目コード3900000 = field(3) + adding(90) + 連番(0000)
      field: 3,
      adding: 90
    }
  }
];

export const ensureSystemAccounts = async (options = {}) => {
  const created = [];
  for ( const def of SYSTEM_ACCOUNTS ) {
    const existingAccount = await models.Account.findOne({
      where: { accountCode: def.accountCode },
      transaction: options.transaction
    });
    if ( existingAccount ) {
      continue;
    }
    // 分類は「なかったらINSERT」。field+adding で一意に解決する
    let accountClass = await models.AccountClass.findOne({
      where: {
        field: def.accountClass.field,
        adding: def.accountClass.adding
      },
      transaction: options.transaction
    });
    if ( !accountClass ) {
      accountClass = await models.AccountClass.create({
        ...def.accountClass
      }, { transaction: options.transaction });
    }
    const account = await models.Account.create({
      name: def.name,
      key: def.key,
      accountClassId: accountClass.id,
      accountCode: def.accountCode,
      taxClass: def.taxClass,
      subAccountCount: 0
    }, { transaction: options.transaction });
    // 既存の期分の残高行をゼロで用意する（初期設定後に取れた期に対応）
    const years = await models.FiscalYear.findAll({ transaction: options.transaction });
    for ( const year of years ) {
      await models.AccountRemaining.findOrCreate({
        where: { accountId: account.id, term: year.term },
        defaults: {
          accountId: account.id,
          term: year.term,
          debit: 0,
          credit: 0,
          balance: 0
        },
        transaction: options.transaction
      });
    }
    created.push(def.accountCode);
  }
  return created;
};

export default ensureSystemAccounts;
