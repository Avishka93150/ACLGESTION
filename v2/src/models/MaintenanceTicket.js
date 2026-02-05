const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceTicket = sequelize.define('MaintenanceTicket', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  hotel_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'hotels',
      key: 'id'
    }
  },
  room_number: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM('plomberie', 'electricite', 'climatisation', 'mobilier', 'serrurerie', 'peinture', 'nettoyage', 'autre'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  photo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'resolved'),
    defaultValue: 'open'
  },
  reported_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  assigned_to: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  resolved_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notified_48h: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  notified_72h: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  notified_2days: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  notified_5days: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  room_blocked: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  }
}, {
  tableName: 'maintenance_tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = MaintenanceTicket;
