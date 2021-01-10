# sharedb-dynamodb

DynamoDB database adapter for [sharedb](https://github.com/share/sharedb). This
driver can be used both as a snapshot store and oplog.

Doesn't support queries (yet?).

## Usage

`sharedb-postgres` wraps native [node-postgres](https://github.com/brianc/node-postgres), and it supports the same configuration options.

To instantiate a sharedb-postgres wrapper, invoke the module and pass in your
PostgreSQL configuration as an argument. For example:

```js
var ShareDBDynamo = require("sharedb-dynamodb");
var backend = require("sharedb")({ db: new ShareDBDynamo() });
```
