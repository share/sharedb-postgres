const PostgresDB = require('.');
const {Pool} = require('pg');
const fs = require('node:fs');
const {expect} = require('chai');
const sinon = require('sinon');
const Backend = require('sharedb');

const DB_NAME = 'sharedbtest';

function create(callback) {
  var db = new PostgresDB({database: DB_NAME});
  callback(null, db);
};

function promisifyCallback(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (error, result) => error ? reject(error) : resolve(result));
  });
}

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

  describe('getSnapshot with fields', () => {
    let db;
    let commit;
    let getSnapshot;

    beforeEach(async () => {
      db = new PostgresDB({database: DB_NAME});
      commit = promisifyCallback(db.commit.bind(db));
      getSnapshot = promisifyCallback(db.getSnapshot.bind(db));
      const snapshot = {type: 'json0', v: 1, data: {x: 5, y: 6}, m: {test: 3}};
      await commit('testcollection', 'test', {v: 0, create: {}}, snapshot, null);
    });

    afterEach(async () => {
      sinon.restore();
      await db.close();
    });

    it('does not read data when fields is empty', async () => {
      const query = sinon.spy(db._pool, 'query');
      const snapshot = await getSnapshot('testcollection', 'test', {}, null);
      expect(snapshot).to.eql({id: 'test', v: 1, type: 'json0', data: {}, m: null});
      expect(query.lastCall.args[0]).not.to.match(/(?<!AS )\bdata\b/);
    });

    it('returns no data for a deleted doc when fields is empty', async () => {
      const deleted = {type: null, v: 2, data: undefined};
      await commit('testcollection', 'test', {v: 1, del: true}, deleted, null);
      const snapshot = await getSnapshot('testcollection', 'test', {}, null);
      expect(snapshot).to.eql({id: 'test', v: 2, type: null, data: undefined, m: null});
    });

    it('returns no data for a deleted doc when fields has keys', async () => {
      const deleted = {type: null, v: 2, data: undefined};
      await commit('testcollection', 'test', {v: 1, del: true}, deleted, null);
      const snapshot = await getSnapshot('testcollection', 'test', {x: true}, null);
      expect(snapshot.data).to.equal(undefined);
    });

    it('returns a v0 snapshot for a missing doc when fields is empty', async () => {
      const snapshot = await getSnapshot('testcollection', 'missing', {}, null);
      expect(snapshot).to.eql({id: 'missing', v: 0, type: null, data: undefined, m: null});
    });

    it('returns only the requested keys', async () => {
      const snapshot = await getSnapshot('testcollection', 'test', {y: true}, null);
      expect(snapshot.data).to.eql({y: 6});
    });

    it('returns empty data when no requested key exists', async () => {
      const snapshot = await getSnapshot('testcollection', 'test', {z: true}, null);
      expect(snapshot.data).to.eql({});
    });

    it('returns non-object data untouched when fields has keys', async () => {
      const snapshot = {type: 'json0', v: 1, data: [1, 2]};
      await commit('testcollection', 'array', {v: 0, create: {}}, snapshot, null);
      const result = await getSnapshot('testcollection', 'array', {x: true}, null);
      expect(result.data).to.eql([1, 2]);
    });

    it('returns empty data for non-object data when fields is empty', async () => {
      const snapshot = {type: 'json0', v: 1, data: [1, 2]};
      await commit('testcollection', 'array', {v: 0, create: {}}, snapshot, null);
      const result = await getSnapshot('testcollection', 'array', {}, null);
      expect(result.data).to.eql({});
    });

    it('returns all data and metadata when fields has $submit', async () => {
      const snapshot = await getSnapshot('testcollection', 'test', {$submit: true, x: true}, null);
      expect(snapshot.data).to.eql({x: 5, y: 6});
      expect(snapshot.m).to.eql({test: 3});
    });
  });

  describe('through a Backend', function() {
    beforeEach(function() {
      this.backend = new Backend({db: new PostgresDB({database: DB_NAME})});
    });

    afterEach(function(done) {
      this.backend.close(done);
    });

    require('sharedb/test/client/projections')({});

    it('projects non-object data to null', async function() {
      this.backend.addProjection('summary', 'testcollection', {x: true});
      const connection = this.backend.connect();
      const doc = connection.get('testcollection', 'array');
      await promisifyCallback(doc.create.bind(doc))([1, 2]);

      const connection2 = this.backend.connect();
      const summary = connection2.get('summary', 'array');
      await promisifyCallback(summary.fetch.bind(summary))();
      expect(summary.data).to.equal(null);
    });
  });
});
