/**
 * ACL GESTION v2 - Configuration Sequelize / MySQL
 *
 * Initialise la connexion Sequelize avec mysql2,
 * pool de connexions et timezone Europe/Paris.
 */
const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('./logger');

const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.pass,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    dialectModule: require('mysql2'),

    // Pool de connexions
    pool: {
      min: config.db.pool.min,
      max: config.db.pool.max,
      acquire: 30000,   // delai max pour obtenir une connexion (ms)
      idle: 10000        // duree avant liberation d'une connexion inactive (ms)
    },

    // Timezone
    timezone: '+01:00', // Europe/Paris (CET) – ajuster pour CEST si besoin
    dialectOptions: {
      timezone: '+01:00',
      dateStrings: true,
      typeCast: true
    },

    // Logging : redirige les requetes SQL vers Winston en mode debug
    logging: config.app.env === 'development'
      ? (msg) => logger.debug(msg)
      : false,

    // Options globales pour les modeles
    define: {
      timestamps: true,      // created_at / updated_at automatiques
      underscored: true,      // snake_case pour les colonnes
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  }
);

module.exports = { sequelize, Sequelize };
