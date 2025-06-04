import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class VoucherClass extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.Voucher, {
        foreignKey: 'voucherClassId',
        as: 'vouchers'
      });
    }
  }
  VoucherClass.init({
    name: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    send: DataTypes.BOOLEAN,
    form: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'VoucherClass',
  });
  return VoucherClass;
};