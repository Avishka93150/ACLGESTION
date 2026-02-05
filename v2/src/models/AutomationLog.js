const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomationLog = sequelize.define('AutomationLog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  automation_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'automations',
      key: 'id'
    }
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('success', 'error'),
    allowNull: true
  },
  result_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'automation_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AutomationLog;
