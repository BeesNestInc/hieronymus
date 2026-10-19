'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 取込時に判定した形式プロファイル名（bookRules等の適用に使う）
    await queryInterface.addColumn('BankStatements', 'profileName', {
      type: Sequelize.STRING
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('BankStatements', 'profileName');
  }
};
