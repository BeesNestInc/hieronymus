import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class ExpenseMapping extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.belongsTo(models.Company, {
				foreignKey: 'companyId',
				onDelete: 'SET NULL'
			});
		}
	};
	ExpenseMapping.init({
		kind: DataTypes.STRING,
		key: DataTypes.STRING,
		name: DataTypes.STRING,
		companyId: DataTypes.INTEGER,
		account: DataTypes.STRING,
		subAccount: DataTypes.INTEGER,
		advance: DataTypes.BOOLEAN,
		// 同日でもまとめない（1行1伝票に分離する）フラグ
		noBundle: DataTypes.BOOLEAN,
		// 仕訳の振り分けヒント（自由文＋キーワード。空欄はデフォルト扱い）
		description: DataTypes.STRING
	}, {
		sequelize,
		modelName: 'ExpenseMapping',
	});
	return ExpenseMapping;
};
