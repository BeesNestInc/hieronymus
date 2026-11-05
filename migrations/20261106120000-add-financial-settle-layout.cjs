'use strict';

// 計算書の起票レイアウトを口座（Financial）に学習して保存する。
// 「どの摘要を貸借のどこに置くか」をもったまま起票が成功したら覚え、
// 次回の取込で同じ構成の下書きを自動生成するためのもの。
// 本体は JSON 文字列:
//   { lines: [ { label,
//                debit:  { patterns: [正規化摘要...], account, sub },
//                credit: { patterns: [...], account, sub } } ] }
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('Financials', 'settleLayout', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down (queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Financials', 'settleLayout', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
