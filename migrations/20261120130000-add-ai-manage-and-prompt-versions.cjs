// 「AI管理」権限（aiManage）と、AIプロンプトの世代管理テーブルを追加する。
// プロンプトは用途（キー）ごとに世代が積まれ、現世代は最大generation。
// DBに行が無いキーはビルトイン（ai/prompt-templates/*.md）のフォールバック。
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'aiManage', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.createTable('PromptTemplateVersions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      generation: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      createdBy: Sequelize.INTEGER,
      createdAt: Sequelize.DATE
    });
    await queryInterface.addIndex('PromptTemplateVersions', {
      fields: ['key', 'generation'],
      unique: true,
      name: 'prompt_versions_key_generation_unique'
    });
    await queryInterface.addIndex('PromptTemplateVersions', {
      fields: ['key'],
      name: 'prompt_versions_key_idx'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('PromptTemplateVersions', 'prompt_versions_key_idx').catch(() => {});
    await queryInterface.removeIndex('PromptTemplateVersions', 'prompt_versions_key_generation_unique').catch(() => {});
    await queryInterface.dropTable('PromptTemplateVersions');
    await queryInterface.removeColumn('Users', 'aiManage');
  }
};
