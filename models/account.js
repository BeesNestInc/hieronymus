'use strict';
const {
	Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
	class Account extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.hasMany(models.SubAccount, {
				foreignKey: 'accountId',
				sourceKey: 'id',
			});
			this.hasOne(models.AccountClass, {
				foreignKey: 'id',
				sourceKey: 'accountClassId',
			});
		}
	};
	Account.init({
		name: DataTypes.STRING,
		key: DataTypes.STRING,
		accountClassId: DataTypes.INTEGER,
		accountCode: DataTypes.STRING,
		taxClass: DataTypes.INTEGER,
		subAccountCount: DataTypes.INTEGER,
		expiredAt: DataTypes.DATE
	}, {
		sequelize,
		modelName: 'Account',
	});
	return Account;
};
