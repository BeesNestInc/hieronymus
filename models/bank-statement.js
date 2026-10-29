import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class BankStatement extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.hasMany(models.BankStatementLine, {
				foreignKey: 'statementId',
				as: 'lines'
			});
			this.belongsTo(models.Member, {
				foreignKey: 'memberId',
				onDelete: 'SET NULL'
			});
		}
	};
	BankStatement.init({
		// 'bank' | 'corporate_card' | 'personal_card'
		kind: DataTypes.STRING,
		// 銀行系: 勘定科目コードと補助科目（subAccountCode）
		account: DataTypes.STRING,
		subAccount: DataTypes.INTEGER,
		// カード系: カード名称（銀行側の引落摘要との照合にも使う）
		cardName: DataTypes.STRING,
		// 個人カード立替時の提出者
		memberId: DataTypes.INTEGER,
		// 取込ファイル（原典の保全。伝票には添付しない）
		fileName: DataTypes.STRING,
		mimeType: DataTypes.STRING,
		fileBody: DataTypes.BLOB,
		// 取込時に判定した形式プロファイル名（bookRules等の適用に使う）
		profileName: DataTypes.STRING,
		// 取込時の警告（残高整合・重複スキップ等。JSON配列で保存。
		// 取込の最新の物で差し替える）
		warnings: DataTypes.TEXT,
		// 通帳のメモ（取り込の来歴はnoteに書くので、こちらは入力用メモ）
		memo: DataTypes.TEXT,
		periodFrom: DataTypes.DATEONLY,
		periodTo: DataTypes.DATEONLY,
		lineCount: DataTypes.INTEGER,
		// カード明細: 支払総額と支払日（銀行側の引落行との照合に使う）
		total: DataTypes.DECIMAL(12),
		payDate: DataTypes.DATEONLY,
		note: DataTypes.TEXT
	}, {
		sequelize,
		modelName: 'BankStatement',
	});
	return BankStatement;
};
