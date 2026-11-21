// プロンプトの世代に説明（memo）を追加する。世代管理の画面で
// 「何を変えた世代か」をユーザーが記録できるようにする
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('PromptTemplateVersions', 'memo', {
      type: Sequelize.STRING(200),
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('PromptTemplateVersions', 'memo');
  }
};
