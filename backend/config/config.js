
module.exports = {
  development: {
    username: "postgres.whfliaxwyxgweiygziev",
    password: "maya1234suhitime",
    database: "postgres",
    host: "aws-1-eu-central-1.pooler.supabase.com",
    port: 5432,
    dialect: "postgres",
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET ,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  otp: {
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS) || 300,
  },
  email: {
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT) || 587,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
};