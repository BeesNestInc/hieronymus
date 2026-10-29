'use strict';

// 学習ルールに「方向」(入金in/出金out)を足す。同じ摘要でも代理店的な
// 取引先では入金と出金で相手方が異なることがあるため、ルールは方向単位で
// 持つ。既存行は direction = NULL（指定なし=両方向に照合する旧来の
// ルール）として温存し、学習されたルールは常に方向付きになる
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('BankStatementRules', 'direction', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('BankStatementRules', 'direction');
  }
};
