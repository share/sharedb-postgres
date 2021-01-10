var ShareDB = require("sharedb");

const AWS = require("aws-sdk");
const AWS_CONFIG = require("./aws_config");

var credentials = new AWS.SharedIniFileCredentials(
  AWS_CONFIG.SharedIniFileCredentials
);
AWS.config.credentials = credentials;

var dynamodb = new AWS.DynamoDB(AWS_CONFIG.DynamoDB);

class ShareDBDynamo extends ShareDB.DB {
  constructor(options) {
    super(options);
    this.DocumentClient = new AWS.DynamoDB.DocumentClient({
      service: dynamodb,
    });
  }

  close(callback) {
    console.log("\n\nclose");
    this.closed = true;
    // console.log("\n\ndon't need to close dynamodb");
    if (callback) callback();
  }

  rollback(msg, params, err) {
    console.log("\n\nrollback");
    console.log("\n\nTODO: Implement transactions", {
      msg,
      params,
      err,
    });
  }
}

module.exports = ShareDBDynamo;

// Persists an op and snapshot if it is for the next version. Calls back with
// callback(err, succeeded)
ShareDBDynamo.prototype.commit = async function (
  collection,
  doc_id,
  op,
  snapshot,
  options,
  callback
) {
  console.log("\n\ncommit", {
    collection,
    doc_id,
    op,
    snapshot,
    options,
    callback,
  });
  console.log("commit op:", JSON.stringify(op));

  /*
    Operations:
    pk="COLLECTION::${collection}<<OP"
    sk="DOCID::${doc_id}&VERSION::${version}"
    schema: collection, doci_id, version, operation json
    -- maintains a record of all operations

    Snapshot:
    pk="COLLECTION::${collection}<<SNAPSHOT"
    sk="DOCID::${doc_id}&VERSION::${version}"
    schema: collection, doci_id, version, snapshot data
    -- only keeps the latest snapshot (updates)
   */

  // get the latest version
  // TODO: Verify ScanIndexForward should be false and not true
  const latestVersionParams = {
    TableName: AWS_CONFIG.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk and begins_with(#sk, :sk)",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
    },
    ExpressionAttributeValues: {
      ":pk": `COLLECTION::${collection}<<OP`,
      ":sk": `DOCID::${doc_id}`,
    },
    ScanIndexForward: false,
    Limit: 1,
  };

  let latest_version;
  // await this.DocumentClient.query(latestVersionParams, function (err, data) {
  //   if (err) {
  //     console.log({ err });
  //     return callback(err);
  //   } else {
  //     console.log("\n\nlatestVersionParams:", {
  //       latestVersionParams,
  //       data: JSON.stringify(data),
  //       len: data.Items.length,
  //     });
  //     if (data.Items.length > 0) {
  //       latest_version = data.Items[0].version;
  //       console.log("latest_version:", latest_version);
  //     } else {
  //       latest_version = 0;
  //     }
  //   }
  // });

  const versionResults = await this.DocumentClient.query(latestVersionParams)
    .promise()
    .catch((err) => {
      console.log({ err });
      return callback(err);
    });

  console.log("\n\nlatestVersionParams:", {
    latestVersionParams,
    data: JSON.stringify(versionResults),
    len: versionResults.Items.length,
  });

  if (versionResults.Items.length > 0) {
    latest_version = versionResults.Items[0].version;
    console.log("latest_version:", latest_version);
  } else {
    latest_version = 0;
  }

  // .then((data) => {

  // })
  // .catch((err) => {
  //   console.log({ err });
  //   return callback(err);
  // });

  console.log({ versionResults });

  // verify version is after snapshot
  console.log(
    `snapshot.v (${snapshot.v}) !== latest_version+1 (${
      latest_version + 1
    }) === ${snapshot.v !== latest_version + 1}`
  );
  if (snapshot.v !== latest_version + 1) {
    return callback(null, false);
  }

  // add op record
  var newOpParams = {
    TableName: AWS_CONFIG.TABLE_NAME,
    Item: {
      pk: `COLLECTION::${collection}<<OP`,
      sk: `DOCID::${doc_id}&VERSION::${latest_version + 1}`,
      collection: collection,
      doc_id,
      version: latest_version + 1,
      operation: op,
    },
  };

  await this.DocumentClient.put(newOpParams, function (err, data) {
    if (err) {
      this.rollback("adding new op", newOpParams, err);
      callback(err);
      return;
    }
    // else console.log("\n\nnewOp:", { newOpParams, data });
  });

  // upsert the snapshot
  var snapshotParams = {
    TableName: AWS_CONFIG.TABLE_NAME,
    Item: {
      pk: `COLLECTION::${collection}<<SNAPSHOT`,
      sk: `DOCID::${doc_id}&VERSION::${snapshot.v}`,
      collection: collection,
      doc_id,
      doc_type: snapshot.type,
      version: snapshot.v,
      data: snapshot.data,
    },
  };

  this.DocumentClient.put(snapshotParams, function (err, data) {
    if (err) {
      this.rollback("updating snapshot", snapshotParams, err);
      callback(err);
      return;
    }
    // else console.log(data);
  });
};

// Get the named document from the database. The callback is called with (err,
// snapshot). A snapshot with a version of zero is returned if the docuemnt
// has never been created in the database.
ShareDBDynamo.prototype.getSnapshot = async function (
  collection,
  doc_id,
  fields,
  options,
  callback
) {
  console.log("\n\ngetSnapshot", {
    collection,
    doc_id,
    fields,
    options,
    callback,
  });

  /*
  get the latest snapshot by collection and doc_id (sorted by version)
  return a DynamoDBSnapshot -- new/null if no snapshot is returned
  */

  const latestSnapshotParams = {
    TableName: AWS_CONFIG.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk and begins_with(#sk, :sk)",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
    },
    ExpressionAttributeValues: {
      ":pk": `COLLECTION::${collection}<<SNAPSHOT`,
      ":sk": `DOCID::${doc_id}`,
    },
    ScanIndexForward: false,
  };

  let latestSnapshot = new DynamoSnapshot(doc_id);
  await this.DocumentClient.query(latestSnapshotParams, function (err, data) {
    if (err) {
      console.log({ err });
      return callback(err);
    } else {
      // console.log("\n\nlatestSnapshotParams:", {
      //   latestSnapshotParams,
      //   data,
      //   len: data.Items.length,
      // });
      if (data.Items.length > 0) {
        results = data.Items[0];
        // console.log("\n\nlatestSnapshotParams results:", results);
        latestSnapshot = new DynamoSnapshot(
          doc_id,
          results.version,
          results.doc_type,
          results.data
        );
        // console.log("\n\nlatestSnapshotParams results:", latestSnapshot);
      }
      callback(null, latestSnapshot);
    }
  });
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
ShareDBDynamo.prototype.getOps = async function (
  collection,
  doc_id,
  from,
  to,
  options,
  callback
) {
  console.log("\n\ngetOps", {
    collection,
    doc_id,
    from,
    to,
    options,
    callback,
  });
  // console.log({ from, to });

  var opRangeParams = {
    TableName: AWS_CONFIG.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk and sk between :sk1 and :sk2",
    ExpressionAttributeNames: {
      "#pk": "pk",
    },
    ExpressionAttributeValues: {
      ":pk": `COLLECTION::${collection}<<OP`,
      ":sk1": `DOCID::${doc_id}&VERSION::${from}`,
      ":sk2": `DOCID::${doc_id}&VERSION::${to - 1}`,
    },
  };

  if (to === null) {
    opRangeParams.KeyConditionExpression = "#pk = :pk and sk >= :sk1";
    delete opRangeParams.ExpressionAttributeValues[":sk2"];
  }

  await this.DocumentClient.query(opRangeParams, function (err, data) {
    if (err) {
      console.log({ err });
      callback(err);
      return;
    } else {
      // console.log("\n\nopRangeParams:", { opRangeParams, data });
      console.log("data:", JSON.stringify(data.Items));
      const operation_list = data.Items.map((row) => row.operation);
      console.log("operation_list:", JSON.stringify(operation_list));
      callback(null, operation_list);
    }
  });
};

class DynamoSnapshot {
  constructor(
    doc_id,
    version = 0,
    doc_type = null,
    data = undefined,
    meta = undefined
  ) {
    this.id = doc_id;
    this.v = version;
    this.type = doc_type;
    this.data = data;
    this.m = meta;
  }
}
