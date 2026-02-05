const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditQuestion = sequelize.define('AuditQuestion', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  grid_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'audit_grids',
      key: 'id'
    }
  },
  section: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  response_type: {
    type: DataTypes.ENUM('score', 'yesno', 'choice', 'text'),
    defaultValue: 'score'
  },
  choices: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  weight: {
    type: DataTypes.DECIMAL(3, 1),
    defaultValue: 1.0
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_required: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  }
}, {
  tableName: 'audit_questions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AuditQuestion;
