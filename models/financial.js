import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class Financial extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.hasMany(models.BankStatement, {
				foreignKey: 'financialId',
				sourceKey: 'id',
				as: 'statements'
			});
			this.belongsTo(models.Member, {
				foreignKey: 'memberId',
				sourceKey: 'id',
				as: 'member'
			});
		}
	};
	// 口座。取り込（BankStatement）の集積体で、「通帳・カード」の正体。
	// 銀行=勘定科目(101系)+銀行補助、法人カード=未払金(203系)+カード補助、
	// 個人カード=仮払金(113系)+立替者補助。次年度以降も使い回し、
	// 「もう使わない」は closedAt で表す（非活性化して一覧から消える）
	Financial.init({
		// 通帳名（一覧表示。例「住信SBI」「三井住友カード」）
		name: DataTypes.STRING,
		// 'bank' | 'corporate_card' | 'personal_card'
		kind: DataTypes.STRING,
		// この口座で起票した行が載る勘定科目+補助
		accountCode: DataTypes.STRING,
		subAccountCode: DataTypes.INTEGER,
		// 個人カードの立替者
		memberId: DataTypes.INTEGER,
		// カード系のYAMLプロファイル名（任意。取込解析のヒント）
		profileName: DataTypes.STRING,
		// 「もう使わない」マーキング。null=使用中
		closedAt: DataTypes.DATE,
		// メモ（口座の備忘。例: カード番号下4桁、更新月など）
		memo: DataTypes.TEXT
	}, {
		sequelize,
		modelName: 'Financial',
	});
	return Financial;
};
