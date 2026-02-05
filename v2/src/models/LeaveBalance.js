const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LeaveBalance = sequelize.define('LeaveBalance', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cp_total: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 0
  },
  cp_used: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 0
  },
  rtt_total: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 0
  },
  rtt_used: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 0
  }
}, {
  tableName: 'leave_balance',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'year'],
      name: 'unique_balance'
    }
  ]
});

module.exports = LeaveBalance;
