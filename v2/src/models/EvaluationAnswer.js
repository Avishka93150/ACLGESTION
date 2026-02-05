const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EvaluationAnswer = sequelize.define('EvaluationAnswer', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  evaluation_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'evaluations',
      key: 'id'
    }
  },
  question_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'evaluation_questions',
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
  }
}, {
  tableName: 'evaluation_answers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = EvaluationAnswer;
