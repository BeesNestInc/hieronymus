'use strict';

// 精算書の明細行に、それが載った仕訳伝票への参照を持たせる。
// 承認時の分割起票で「どの行がどの伝票に入ったか」を記録し、
// 明細表を伝票単位でグループ化して表示するために使う。
// 伝票側の expenseReportId（1:n）と並ぶ行単位の逆FK。伝票削除時はSET NULL。
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ExpenseReportLines', 'crossSlipId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addConstraint('ExpenseReportLines', {
      fields: ['crossSlipId'],
      type: 'foreign key',
      name: 'expensereportlines_cross_slip_fk',
      references: {
        table: 'CrossSlips',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('ExpenseReportLines', ['crossSlipId'], {
      name: 'expensereportlines_cross_slip_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('ExpenseReportLines', 'expensereportlines_cross_slip_fk');
    await queryInterface.removeIndex('ExpenseReportLines', 'expensereportlines_cross_slip_id');
    await queryInterface.removeColumn('ExpenseReportLines', 'crossSlipId');
  }
};
