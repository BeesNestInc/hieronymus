import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class LabelAccount extends Model {
    static associate(models) {
      // no association
    }
  };
  LabelAccount.init({
    labelId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    accountCode: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    summaryType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'credit'
    }
  }, {
    sequelize,
    modelName: 'LabelAccount',
  });
  return LabelAccount;
};
