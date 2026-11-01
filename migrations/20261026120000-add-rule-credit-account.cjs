'use strict';

// 学習ルールに「貸方の指定」を持たせる（任意）。
// 通常は口座の勘定科目（未払金・普通預金等）が貸方になるが、
// キャッシングリボのように貸方が短期借入金になる特殊行がある。
// null なら口座の勘定科目を使う（従来どおり）
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('BankStatementRules', 'creditAccount', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction: t });
      await queryInterface.addColumn('BankStatementRules', 'creditSubAccount', {
        type: Sequelize.INTEGER,
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
      await queryInterface.removeColumn('BankStatementRules', 'creditSubAccount', { transaction: t });
      await queryInterface.removeColumn('BankStatementRules', 'creditAccount', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
