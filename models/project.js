import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Project extends Model {
    static associate(models) {
      this.hasMany(models.CrossSlipDetail, {
        foreignKey: 'projectId',
        as: 'crossSlipDetails'
      });
      this.belongsToMany(models.Label, {
        through: 'ProjectLabels',
        foreignKey: 'projectId',
        otherKey: 'labelId',
        as: 'labels'
      });
      this.hasMany(models.ProjectLabel, {
        foreignKey: 'projectId',
        as: 'projectLabelItems' // ユニークなエイリアスを追加
      });
    }
  };
  Project.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      unique: true
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Project',
  });
  return Project;
};
