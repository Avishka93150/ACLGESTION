const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditAnswer = sequelize.define('AuditAnswer', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  audit_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'audits',
      key: 'id'
    }
  },
  question_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'audit_questions',
      key: 'id'
    }
  },
  score: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attachment_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  photo_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'audit_answers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AuditAnswer;
