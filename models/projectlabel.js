import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class ProjectLabel extends Model {
    static associate(models) {
      // no association
    }
  };
  ProjectLabel.init({
    projectId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    labelId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'ProjectLabel',
  });
  return ProjectLabel;
};