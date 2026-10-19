import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class BankStatementRule extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
		}
	};
	// 学習ルール: 摘要パターン → 相手方仕訳（銀行明細からの起票を自動化するために蓄積する）
	BankStatementRule.init({
		// 学習元の口座（科目コード + 補助科目。subAccount null は口座全体で共通）
		account: DataTypes.STRING,
		subAccount: DataTypes.INTEGER,
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
