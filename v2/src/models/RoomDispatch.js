const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomDispatch = sequelize.define('RoomDispatch', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  room_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  dispatch_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  cleaning_type: {
    type: DataTypes.ENUM('blanc', 'recouche'),
    allowNull: false
  },
  assigned_to: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'controlled'),
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('normal', 'urgent'),
    defaultValue: 'normal'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  controlled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  controlled_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  control_status: {
    type: DataTypes.ENUM('ok', 'nok'),
    allowNull: true,
    defaultValue: null
  },
  control_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  control_photos: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ctrl_literie: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  },
  ctrl_salle_bain: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  },
  ctrl_sol_surfaces: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  },
  ctrl_equipements: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  },
  ctrl_ambiance: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  },
  ctrl_proprete: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'room_dispatch',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['room_id', 'dispatch_date'],
      name: 'unique_dispatch'
    }
  ]
});

module.exports = RoomDispatch;
