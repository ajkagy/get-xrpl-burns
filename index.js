var xrpl = require("xrpl");
const fs = require("fs");
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const writeStream = fs.createWriteStream("uga_burns.csv");
const issuer = "rBFJGmWj6YaabVCxfsjiCM8pfYXs8xFdeC"; //Uga issuer
const currency = "UGA";

function GetAccountTxns(marker, account, limitVal, forwardVal = false) {
  return {
    command: "account_tx",
    account: account,
    tx_type: "Payment",
    forward: forwardVal,
    limit: limitVal,
    ...(marker != undefined && { marker: marker }),
  };
}

async function writeHeaders() {
  let array = [];
  array.push("account");
  array.push("amount_burnt");
  array.push("date_time");
  array.push("ledger_index");
  writeStream.write('"' + array.join('","') + '"\n');
}

async function processTransactions(transactions) {
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    try {
      if (typeof transaction.meta.delivered_amount == "object") {
        if (
          transaction.meta.delivered_amount.issuer == issuer &&
          transaction.meta.delivered_amount.currency == currency &&
          transaction.tx_json.Destination == issuer
        ) {
          let array = [];
          array.push(transaction.tx_json.Account);
          array.push(transaction.meta.delivered_amount.value);
          array.push(xrpl.rippleTimeToISOTime(transaction.tx_json.date));
          array.push(transaction.tx_json.ledger_index);
          writeStream.write('"' + array.join('","') + '"\n');
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}

async function main() {
  writeHeaders();
  const client = new xrpl.Client("wss://s1.ripple.com/");
  try {
    await client.connect();

    let marker = undefined;
    await timer(2000);
    const txn_response = await client.request(
      GetAccountTxns(marker, issuer, 200, false)
    );
    marker = txn_response.result.marker;
    console.log(
      "processing ",
      txn_response.result.transactions.length,
      " transactions at ",
      "first found ledger"
    );
    processTransactions(txn_response.result.transactions);

    while (marker != undefined) {
      await timer(2000);
      const txn_response_loop = await client.request(
        GetAccountTxns(marker, issuer, 200, false)
      );
      marker = txn_response_loop.result.marker;
      console.log(
        "processing ",
        txn_response.result.transactions.length,
        " transactions at ledger: ",
        marker == undefined ? "last found ledger" : marker.ledger
      );
      processTransactions(txn_response_loop.result.transactions);
    }
    console.log("Finished Successfully");
    process.exit();
  } catch (err) {
    console.log(err);
  } finally {
    if (client.isConnected) {
      try {
        await client.disconnect();
      } catch (err) {}
    }
  }
}

main();
