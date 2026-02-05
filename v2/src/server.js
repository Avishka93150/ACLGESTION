/**
 * ACL GESTION v2 - Server Entry Point
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const logger = require('./config/logger');
const routes = require('./routes');
const { sequelize } = require('./models');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // We serve a SPA
}));

// CORS
const corsOptions = {
  origin: config.security.corsOrigins.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.app.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// Static files - Uploads
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.dir || 'uploads')));

// Static files - Frontend (SPA)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api', routes);

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: config.app.env === 'production' ? 'Erreur interne du serveur' : err.message,
    ...(config.app.env === 'development' && { stack: err.stack })
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Connexion base de donnees OK');

    // Sync models (don't alter in production - use migrations)
    if (config.app.env === 'development') {
      await sequelize.sync({ alter: false });
    }

    const PORT = config.app.port;
    app.listen(PORT, () => {
      logger.info(`ACL GESTION v2 demarre sur le port ${PORT}`);
      logger.info(`Environnement: ${config.app.env}`);
      logger.info(`URL: ${config.app.url}`);
    });
  } catch (error) {
    logger.error('Erreur de demarrage:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recu, arret en cours...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recu, arret en cours...');
  await sequelize.close();
  process.exit(0);
});

start();

module.exports = app;
