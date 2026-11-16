import {Model} from 'sequelize';

// 予定表（資金繰り予定）。会社単位の共有データ。
// 月次の定常入出金（家賃・給与支払等）と単発の予定を持ち、
// 月次一覧の展開とICSフィードの元になる。
export default (sequelize, DataTypes) => {
  class Schedule extends Model {
    static associate(models) {
    }
  }
  Schedule.init({
    title: DataTypes.STRING,
    // 'in'（入金）/ 'out'（出金）
    kind: DataTypes.STRING(8),
    amount: DataTypes.BIGINT,
    // 'monthly'（dayOfMonth）/ 'once'（date）
    recurrence: DataTypes.STRING(16),
    // monthly の発生日。1-31（月に存在しない日はその月の末日に繰り上げ）、0=月末
    dayOfMonth: DataTypes.INTEGER,
    // once の発生日
    date: DataTypes.DATEONLY,
    note: DataTypes.TEXT,
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Schedule',
  });
  return Schedule;
};
