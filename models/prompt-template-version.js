import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class PromptTemplateVersion extends Model {
		static associate(models) {
			// 作成者
			this.belongsTo(models.User, {
				foreignKey: 'createdBy',
				as: 'author',
				onDelete: 'SET NULL'
			});
		}
	};
	PromptTemplateVersion.init({
		// 用途キー（manifestのsystemPrompt名。ocr-statement等）
		key: DataTypes.STRING(64),
		generation: DataTypes.INTEGER,
		body: DataTypes.TEXT,
		// 世代の説明（何を変えた世代か）
		memo: DataTypes.STRING(200),
		createdBy: DataTypes.INTEGER,
		createdAt: DataTypes.DATE
	}, {
		sequelize,
		modelName: 'PromptTemplateVersion',
		tableName: 'PromptTemplateVersions',
		// 履歴テーブル: createdAtのみ（updatedAtは履歴に無い）
		updatedAt: false
	});
	return PromptTemplateVersion;
};
