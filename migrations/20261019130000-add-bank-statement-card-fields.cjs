'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // カード明細の支払総額・支払日（銀行側の引落行との照合に使う）
    await queryInterface.addColumn('BankStatements', 'total', {
      type: Sequelize.DECIMAL(12)
    });
    await queryInterface.addColumn('BankStatements', 'payDate', {
      type: Sequelize.DATEONLY
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('BankStatements', 'total');
    await queryInterface.removeColumn('BankStatements', 'payDate');
  }
};
