import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class BankStatementRule extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// ルールは口座単位で持つ（通帳・カードごとの摘要→相手方）
			this.belongsTo(models.Financial, {
				foreignKey: 'financialId',
				as: 'financial'
			});
		}
	};
	// 学習ルール: 摘要パターン → 相手方仕訳（銀行明細からの起票を自動化するために蓄積する）
	BankStatementRule.init({
		// 学習元の口座
		financialId: DataTypes.INTEGER,
		// 旧キー（科目コード+補助。Financial導入前の互換。照合はfinancialIdで行う）
		account: DataTypes.STRING,
		subAccount: DataTypes.INTEGER,
		// 方向（'out' 出金 / 'in' 入金 / null 指定なし=両方向に照合する旧ルール）。
		// 同じ摘要でも代理店的な取引先では入金と出金で相手方が異なることがある
		direction: DataTypes.STRING,
		// 摘要の正規化テンプレート（数字を'#'に置換。完全一致で照合する）
		pattern: DataTypes.STRING,
		oppositeAccount: DataTypes.STRING,
		oppositeSubAccount: DataTypes.INTEGER,
		// 適用回数（多いものを優先）
		usageCount: DataTypes.INTEGER
	}, {
		sequelize,
		modelName: 'BankStatementRule',
	});
	return BankStatementRule;
};
