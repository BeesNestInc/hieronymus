'use strict';

// 証憑に「OK済み（もう誰も処理しなくていい）」の意思表示を持たせる。
// 承認と同じ settledAt + settledBy の監査付きパターン（BOOLEANは使わない）。
// 解除は両列をnullにする（履歴は残らない。disapproveと同型の限界を飲む）。
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Vouchers', 'settledAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('Vouchers', 'settledBy', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addConstraint('Vouchers', {
      fields: [ 'settledBy' ],
      type: 'foreign key',
      name: 'vouchers_settled_by_fk',
      references: {
        table: 'Users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('Vouchers', [ 'settledBy' ], {
      name: 'vouchers_settled_by'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Vouchers', 'vouchers_settled_by_fk');
    await queryInterface.removeIndex('Vouchers', 'vouchers_settled_by');
    await queryInterface.removeColumn('Vouchers', 'settledBy');
    await queryInterface.removeColumn('Vouchers', 'settledAt');
  }
};
