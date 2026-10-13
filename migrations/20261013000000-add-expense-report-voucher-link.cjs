'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Vouchers', 'expenseReportId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'ExpenseReports',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('Vouchers', ['expenseReportId'], {
      name: 'Vouchers_expenseReportId'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('Vouchers', 'Vouchers_expenseReportId');
    await queryInterface.removeColumn('Vouchers', 'expenseReportId');
  }
};
