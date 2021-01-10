# sharedb-dynamodb

DynamoDB database adapter for [sharedb](https://github.com/share/sharedb). This
driver can be used both as a snapshot store and oplog.

Doesn't support queries (yet?).

## Usage

```js
var ShareDBDynamo = require("sharedb-dynamodb");
var backend = require("sharedb")({ db: new ShareDBDynamo() });
```
