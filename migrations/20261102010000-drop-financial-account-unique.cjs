'use strict';

// 同じ勘定科目+補助で複数の口座（Financial）を許す。
// 実運用ではカード（法人・個人）やサブ銀行口座が同じ科目/補助を
// 共有する（例: 仮払金1130000を銀行と个人カードの両方で使う）。
// 学習ルールのスコープはfinancialId（口座単位）なので混ざることはなく、
// unique制約はむしろ口座登録の妨げになるため撤去する。
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    await queryInterface.removeConstraint('Financials', 'Financials_account_sub_unique');
  },

  async down (queryInterface) {
    await queryInterface.addConstraint('Financials', {
      fields: [ 'accountCode', 'subAccountCode' ],
      type: 'unique',
      name: 'Financials_account_sub_unique'
    });
  }
};
