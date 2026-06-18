const config = {
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
  }
};

module.exports = config;