# sharedb-postgres-jsonb

Enhanced PostgreSQL database adapter for [sharedb](https://github.com/share/sharedb). This
driver can be used both as a snapshot store and oplog.

This a fork of [sharedb-postgres](https://github.com/share/sharedb-postgres) that should fix the [high concurency issues](https://github.com/share/sharedb-postgres/issues/1) by updating the snapshot and inserting the operation in the same transcation. In order to better impletment queries in the future, the postgres JSONB datatype is used instead. As a result of this you now need Postgres 9.5+.

Also note, this now uses a pool of database conections instead. 

## Usage

`sharedb-postgres-jsonb` wraps native [node-postgres](https://github.com/brianc/node-postgres), and it supports the same configuration options.

To instantiate a sharedb-postgres wrapper, invoke the module and pass in your
PostgreSQL configuration as an argument or use environmental arguments. For example:

```js
var db = require('sharedb-postgres-jsonb');
var backend = require('sharedb')({db: new db()})
```

## Error codes

PostgreSQL errors are passed back directly.
