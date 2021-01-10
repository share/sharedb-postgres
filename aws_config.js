const AWS_CONFIG = {
  SharedIniFileCredentials: { profile: "cronilog" },
  DynamoDB: { region: "us-east-1" },
  TABLE_NAME: "dev-cron-data",
};

module.exports = AWS_CONFIG;
