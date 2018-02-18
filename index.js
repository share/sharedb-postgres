import {DB} from 'sharedb';
import pg from 'pg';

// Postgres-backed ShareDB database

class PostgresDB {
  constructor(options) {
    DB.call(this, options);

    this.closed = false;

    this.pg_config = options;

  }

  close(callback) {
    this.closed = true;
    if (callback) callback();
  }

  // Persists an op and snapshot if it is for the next version. Calls back with
  // callback(err, succeeded)
  commit(collection, id, op, snapshot, options, callback) {
    /*
     * op: CreateOp {
     *   src: '24545654654646',
     *   seq: 1,
     *   v: 0,
     *   create: { type: 'http://sharejs.org/types/JSONv0', data: { ... } },
     *   m: { ts: 12333456456 } }
     * }
     * snapshot: PostgresSnapshot
     */
    pg.connect(this.pg_config, (err, client, done) => {
      if (err) {
        done(client);
        callback(err);
        return;
      }
    /*const*/ query = {
      // TODO: investigate if ops should use on conflict
      name: 'sdb-commit-op-and-snap',
      text: `With snaps as (
        Insert into snapshots (collection,doc_id,doc_type, version,data)
        Select n.* From ( select $1 c, $2 d, $4 t, $3 v, $5 daa)
        n 
        where v = (select version+1 v from snapshots where collection = $1 and doc_id = $2 for update) or not exists (select 1 from snapshots where collection = $1 and doc_id = $2 for update)
        On conflict(collection, doc_id) do update set version = $3, data = $5 , doc_type = $2
        Returning version
        ) 
        Insert into ops (collection,doc_id, version,operation)
        Select n.* From ( select $1 c, $2 t, $3 v, $6 daa)
        n 
        where (v = (select version+1 v from ops where collection = $1 and doc_id = $2 for update) or not exists (select 1 from ops where collection = $1 and doc_id = $2 for update)) and exists  (select 1 from snaps)
        On conflict(collection, doc_id, version) do update set version = $3, operation = $6
        Returning version`,
      values: [collection,id,snapshot.v, snapshot.type, snapshot.data,op]
    }
    client.query(query, (err, res) => {
      if (err) {
        console.log(err.stack)
        callback(err)
      } else {
        console.log(res.rows[0])
        callback(null,true)
      }
    })
    
    })
  }

  // Get the named document from the database. The callback is called with (err,
  // snapshot). A snapshot with a version of zero is returned if the docuemnt
  // has never been created in the database.
  getSnapshot(collection, id, fields, options, callback) {
    pg.connect(this.pg_config, (err, client, done) => {
      if (err) {
        done(client);
        callback(err);
        return;
      }
      client.query(
        'SELECT version, data, doc_type FROM snapshots WHERE collection = $1 AND doc_id = $2 LIMIT 1',
        [collection, id],
        (err, res) => {
          done();
          if (err) {
            callback(err);
            return;
          }
          if (res.rows.length) {
            const row = res.rows[0];
            var snapshot = new PostgresSnapshot(
              id,
              row.version,
              row.doc_type,
              row.data,
              undefined // TODO: metadata
            )
            callback(null, snapshot);
          } else {
            var snapshot = new PostgresSnapshot(
              id,
              0,
              null,
              undefined,
              undefined
            )
            callback(null, snapshot);
          }
        }
      )
    })
  }

  // Get operations between [from, to) noninclusively. (Ie, the range should
  // contain start but not end).
  //
  // If end is null, this function should return all operations from start onwards.
  //
  // The operations that getOps returns don't need to have a version: field.
  // The version will be inferred from the parameters if it is missing.
  //
  // Callback should be called as callback(error, [list of ops]);
  getOps(collection, id, from, to, options, callback) {
    pg.connect(this.pg_config, (err, client, done) => {
      if (err) {
        done(client);
        callback(err);
        return;
      }
      client.query(
        'SELECT version, operation FROM ops WHERE collection = $1 AND doc_id = $2 AND version >= $3 AND version < $4',
        [collection, id, from, to],
        (err, res) => {
          done();
          if (err) {
            callback(err);
            return;
          }
          callback(null, res.rows.map(row => row.operation));
        }
      )
    })
  }
}

export default PostgresDB;

class PostgresSnapshot {
  constructor(id, version, type, data, meta) {
    this.id = id;
    this.v = version;
    this.type = type;
    this.data = data;
    this.m = meta;
  }
}