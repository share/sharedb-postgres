# sharedb-postgres

PostgreSQL database adapter for [sharedb](https://github.com/share/sharedb). This
driver can be used both as a snapshot store and oplog.

Doesn't support queries (yet?).

Highly experimental.


## Usage

`sharedb-postgres` wraps native [node-postgres](https://github.com/brianc/node-postgres), and it supports the same configuration options.

To instantiate a sharedb-postgres wrapper, invoke the module and pass in your
PostgreSQL configuration as an argument. For example:

    var db = require('sharedb-postgres')('postgres://localhost/mydb');
    var backend = require('sharedb')({db: db})

## Error codes

PostgreSQL errors are passed back directly.

## MIT License

Copyright (c) 2016 by Jeremy Apthorp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

