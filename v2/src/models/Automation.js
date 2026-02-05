const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Automation = sequelize.define('Automation', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  automation_type: {
    type: DataTypes.ENUM(
      'dispatch_alert',
      'control_alert',
      'maintenance_alert',
      'leaves_reminder',
      'tasks_due',
      'audit_reminder',
      'closure_reminder',
      'revenue_update',
      'system_cleanup'
    ),
    allowNull: false
  },
  schedule_type: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'interval'),
    allowNull: false
  },
  schedule_time: {
    type: DataTypes.TIME,
    allowNull: true
  },
  schedule_day: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  schedule_interval: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_active: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  last_run_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_run_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  run_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'automations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Automation;
