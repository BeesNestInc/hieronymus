import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class TaxRule extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  TaxRule.init({
    label: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    taxClass: DataTypes.INTEGER,
    rate: DataTypes.INTEGER,
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY
  }, {
    sequelize,
    modelName: 'TaxRule',
  });
  return TaxRule;
};