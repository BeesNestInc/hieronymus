// 「人事閲覧」権限（personnelBrowsing）を追加する。
// 人事管理権限（personnelManagement）は読み書きセットなので、経理デスクの
// ように「人事情報は参照するが人事は操作しない」役割には付けられない。
// 会計閲覧権（fiscalBrowsing）と同じ構成の閲覧専用フラグ。
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'personnelBrowsing', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'personnelBrowsing');
  }
};
