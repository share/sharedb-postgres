var DB = require('sharedb').DB;
var pg = require('pg');

const PG_UNIQUE_VIOLATION = '23505';

// Postgres-backed ShareDB database

function PostgresDB(options) {
  if (!(this instanceof PostgresDB)) return new PostgresDB(options);
  DB.call(this, options);

  this.closed = false;

  this._pool = new pg.Pool(options);
};
module.exports = PostgresDB;

PostgresDB.prototype = Object.create(DB.prototype);

PostgresDB.prototype.close = async function(callback) {
  let error;
  try {
    if (!this.closed) {
      this.closed = true;
      await this._pool.end();
    }
  } catch (err) {
    error = err;
  }

  // FIXME: Don't swallow errors. Emit 'error' event?
  if (callback) callback(error);
};


// Persists an op and snapshot if it is for the next version. Calls back with
// callback(err, succeeded)
PostgresDB.prototype.commit = async function(collection, id, op, snapshot, options, callback) {
  try {
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
    /*
    * This query uses common table expression to upsert the snapshot table
    * (iff the new version is exactly 1 more than the latest table or if
    * the document id does not exists)
    *
    * It will then insert into the ops table if it is exactly 1 more than the
    * latest table or it the first operation and iff the previous insert into
    * the snapshot table is successful.
    *
    * This result of this query the version of the newly inserted operation
    * If either the ops or the snapshot insert fails then 0 rows are returned
    *
    * If 0 zeros are return then the callback must return false
    *
    * Casting is required as postgres thinks that collection and doc_id are
    * not varchar
    */
    const query = {
      name: 'sdb-commit-op-and-snap',
      text: `WITH snapshot_id AS (
  INSERT INTO snapshots (collection, doc_id, version, doc_type, data, metadata)
  SELECT $1::varchar collection, $2::varchar doc_id, $3 v, $4 doc_type, $5 d, $6 m
  WHERE $3 = (
    SELECT version+1 v
    FROM snapshots
    WHERE collection = $1 AND doc_id = $2
    FOR UPDATE
  ) OR NOT EXISTS (
    SELECT 1
    FROM snapshots
    WHERE collection = $1 AND doc_id = $2
    FOR UPDATE
  )
  ON CONFLICT (collection, doc_id) DO UPDATE SET version = $3, data = $5, doc_type = $4, metadata = $5
  RETURNING version
)
INSERT INTO ops (collection, doc_id, version, operation)
SELECT $1::varchar collection, $2::varchar doc_id, $3 v, $7 operation
WHERE (
  $3 = (
    SELECT max(version)+1
    FROM ops
    WHERE collection = $1 AND doc_id = $2
  ) OR NOT EXISTS (
    SELECT 1
    FROM ops
    WHERE collection = $1 AND doc_id = $2
  )
) AND EXISTS (SELECT 1 FROM snapshot_id)
RETURNING version`,
      values: [collection, id, snapshot.v, snapshot.type, JSON.stringify(snapshot.data), JSON.stringify(snapshot.m), JSON.stringify(op)]
    }
    const result = await this._pool.query(query);
    const success = result.rowCount > 0;
    callback(null, success);
  } catch (error) {
    // Return non-success instead of duplicate key error, since this is
    // expected to occur during simultaneous creates on the same id
    if (error.code === PG_UNIQUE_VIOLATION) callback(null, false);
    else callback(error);
  }
};

// Get the named document from the database. The callback is called with (err,
// snapshot). A snapshot with a version of zero is returned if the docuemnt
// has never been created in the database.
PostgresDB.prototype.getSnapshot = async function(collection, id, fields, options, callback) {
  fields ||= {};
  options ||= {};
  const wantsMetadata = fields.$submit || options.metadata;
  try {
    const result = await this._pool.query(
      'SELECT version, data, doc_type, metadata FROM snapshots WHERE collection = $1 AND doc_id = $2 LIMIT 1',
      [collection, id],
    );

    var row = result.rows[0]
    const snapshot = {
      id,
      v: row?.version || 0,
      type: row?.doc_type || null,
      data: row?.data || undefined,
      m: wantsMetadata ?
        // Postgres returns null but ShareDB expects undefined
        (row?.metadata || undefined) :
        null,
    };
    callback(null, snapshot);
  } catch (error) {
    callback(error);
  }
};

// Get operations between [from, to) noninclusively. (Ie, the range should
// contain start but not end).
//
// If end is null, this function should return all operations from start onwards.
//
// The operations that getOps returns don't need to have a version: field.
// The version will be inferred from the parameters if it is missing.
//
// Callback should be called as callback(error, [list of ops]);
PostgresDB.prototype.getOps = async function(collection, id, from, to, options, callback) {
  from ||= 0;
  options ||= {};
  const wantsMetadata = options.metadata;
  try {
    var cmd = 'SELECT version, operation FROM ops WHERE collection = $1 AND doc_id = $2 AND version > $3 ';
    var params = [collection, id, from];
    if(to || to == 0) { cmd += ' AND version <= $4'; params.push(to)}
    cmd += ' order by version';
    const result = await this._pool.query(cmd, params);
    callback(null, result.rows.map(({operation}) => {
      if (!wantsMetadata) delete operation.m;
      return operation;
    }));
  } catch (error) {
    callback(error);
  }
};
