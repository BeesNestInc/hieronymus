import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class CustomerClass extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CustomerClass.init({
    name: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    isClient: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CustomerClass',
  });
  return CustomerClass;
};