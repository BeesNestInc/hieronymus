'use strict';

// 支払先/出金元マッピングに「説明」フィールドを追加する。
// 同じ取引先でも内容（書籍/事務用品等）によって仕訳を変えるためのヒント。
// 自由文＋キーワード（カンマ区切り）併用。空欄はデフォルト扱い。
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ExpenseMappings', 'description', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ExpenseMappings', 'description');
  }
};
