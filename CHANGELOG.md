## 3.0.0

Thanks to @billwashere, we upgraded to a more modern version of `pg` (4.5.1 ->
7.4.1), which means that the way the database information is provided has
changed. Previously, you could pass a URL to sharedb-postgres, like:

```js
const db = require('sharedb-postgres')('postgres://localhost/mydb');
```

This is no longer supported, and you must instead pass a config object:

```js
const db = require('sharedb-postgres')({host: 'localhost', database: 'mydb'});
```

See the [node-postgres](https://node-postgres.com/features/connecting)
documentation for more details about what can be passed in the config object.
Additionally, if no object is provided, `pg` will use the same environment
variables as `libpq` (`PGUSER`, `PGHOST` and so on).
