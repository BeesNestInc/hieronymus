import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class Menu extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
			this.belongsTo(models.User, {
				sourceKey: 'userId',
        as: 'user'
			});
    }
  }
  Menu.init({
    userId: DataTypes.INTEGER,
    title: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    body: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Menu',
  });
  return Menu;
};