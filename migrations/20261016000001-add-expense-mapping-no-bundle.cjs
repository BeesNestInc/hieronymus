'use strict';

// 支払先マッピングに「同日まとめない」フラグを追加する。
// true の支払先の行は、同日・同出金元でも1行1伝票として分離して起票する
// （同日の別振込を区別する用途。世間でいう balancing account 違いの分離）。
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ExpenseMappings', 'noBundle', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ExpenseMappings', 'noBundle');
  }
};
