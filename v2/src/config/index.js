/**
 * ACL GESTION v2 - Configuration centralisee
 */
module.exports = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    url: process.env.APP_URL || 'http://localhost:3000',
    name: process.env.APP_NAME || 'ACL GESTION'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || 'acl_gestion',
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || '',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_THIS',
    expiry: process.env.JWT_EXPIRY || '7d'
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 5,
    loginLockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES, 10) || 15
  },
  email: {
    enabled: process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@acl-gestion.com',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@acl-gestion.com'
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  }
};
