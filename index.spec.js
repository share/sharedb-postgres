const PostgresDB = require('.');
const {Pool} = require('pg');
const fs = require('node:fs');

const DB_NAME = 'sharedbtest';

function create(callback) {
  var db = new PostgresDB({database: DB_NAME});
  callback(null, db);
};

describe('PostgresDB', function() {
  let pool;
  let client;

  beforeEach(async () => {
    pool = new Pool({database: 'postgres'});
    client = await pool.connect();
    await client.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await client.query(`CREATE DATABASE ${DB_NAME}`);

    const testPool = new Pool({database: DB_NAME});
    const testClient = await testPool.connect();
    const structure = fs.readFileSync('./structure.sql', 'utf8');
    await testClient.query(structure);
    await testClient.release(true);
    await testPool.end();
  });

  afterEach(async function() {
    await client.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await client.release(true);
    await pool.end();
  });

  require('sharedb/test/db')({create: create});
});
