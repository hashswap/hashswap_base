const { Zilliqa } = require('@zilliqa-js/zilliqa');
const fs = require('fs');
const { BN, Long, units, bytes } = require('@zilliqa-js/util');
const {getAddressFromPrivateKey, getPubKeyFromPrivateKey} = require('@zilliqa-js/crypto');
const zilliqa = new Zilliqa('https://dev-api.zilliqa.com');


const chainId = 333; // chainId of the developer testnet
const msgVersion = 1; // current msgVersion


// replace with your private key
const {privateKey} = require('./secret.json');

// wallet add
const s = () =>
{
  let setup = {
    "zilliqa": zilliqa,
    "VERSION": bytes.pack(chainId, msgVersion),
    "attempts": Long.fromNumber(10),
    "priv_key": privateKey,
  };
  setup["addresses"] = '';
  setup["pub_keys"] = '';
  (() => {
    setup.zilliqa.wallet.addByPrivateKey(setup.priv_key);// add key to wallet
    setup.addresses = getAddressFromPrivateKey(setup.priv_key); // compute and store address
    setup.pub_keys = getPubKeyFromPrivateKey(setup.priv_key); // compute and store public key
  })();
  return setup;
}
const setup = s();
exports.setup = setup;



module.exports = {setup, read, deployOracle, sc_call};

// read a file and return contents as a string
function read(f)
{
  t = fs.readFileSync(f, 'utf8', (err,txt) => {
    if (err) throw err;
  });
  return t;
}

// deploy a smart contract whose code is in a file with given init arguments
async function deploy_from_code(code, init, tx_settings)
{
  const contract = setup.zilliqa.contracts.new(code, init);
  return contract.deploy(
    { version: setup.VERSION, gasPrice: tx_settings.gas_price, gasLimit: tx_settings.gas_limit, },
    tx_settings.attempts, tx_settings.timeout, false
  );
}


// call a smart contract's transition with given args and an amount to send from a given public key
async function sc_call(sc, transition, args = [], amt = new BN(0), caller_pub_key = setup.pub_keys, tx_settings)
{
  return sc.call(
    transition,
    args,
    { version: setup.VERSION, amount: amt, gasPrice: tx_settings.gas_price,
      gasLimit: tx_settings.gas_limit, pubKey: caller_pub_key, },
    tx_settings.attempts, tx_settings.timeout, true,
  );
}



// ORACLE
async function deployOracle() {

    const contractName = 'Oracle';
    // will use same tx settings for all tx's

    const tx_settings = {
      "gas_price": units.toQa('3000', units.Units.Li),
      "gas_limit": Long.fromNumber(20000),
      "attempts": 33,
      "timeout": 1000,
    };

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'owner',
          type: 'ByStr20',
          value: setup.pub_keys,
        },
      ];
    const code = read('./scillacodes/hw.scilla');
    console.log(code);
    try {
    console.log('deploying : ',contractName);
    const [tx, ct] = await deploy_from_code(code, init, tx_settings);
    console.log('Transaction ID : ',tx.id);
    console.log(contractName, ' deployed at : ', ct.address);
    } catch (err) {
      console.log(err,'deployment failed : ',contractName);
    }
}

// REGISTER
 function deployRegister(oracleAddress) {

    const contractName = 'Register';

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'owner',
          type: 'ByStr20',
          value: `${owner}`,
        },
      ];
    
    const stringToReplace = '0x3396ee3eab04d3033c20474a3cb538ac7f6b4a18';
    const code = read('./scillacodes/Register.scilla').replace(stringToReplace, oracleAddress);

    return deployone(code, init, contractName);

}

// HASH
 function deployHash() {

    const contractName = 'Hash';

    const tokenName = 'Hash';
    const symbol = 'HASH';
    const decimals = '10';
    const init_supply = '1000000000000000000';

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'contract_owner',
          type: 'ByStr20',
          value: `${owner}`,
        },
        {
            vname: 'name',
            type: 'String',
            value: `${tokenName}`,
        },
        {
            vname: 'symbol',
            type: 'String',
            value: `${symbol}`,
        },
        {
            vname: 'decimals',
            type: 'Uint32',
            value: `${decimals}`,
        },
        {
            vname: 'init_supply',
            type: 'Uint32',
            value: `${init_supply}`,
        },                 
      ];
    
    const code = read('./scillacodes/HASH.scilla')

    return deployone(code, init, contractName);

}



// HUSD
 function deployHusd(hashAddress) {

    const contractName = 'Husd';

    const tokenName = 'Husd';
    const symbol = 'HUSD';
    const decimals = '10';
    const init_supply = '1000000000000000000';

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'contract_owner',
          type: 'ByStr20',
          value: `${owner}`,
        },
        {
            vname: 'hash_address',
            type: 'ByStr20',
            value: `${hashAddress}`,
          },        
        {
            vname: 'name',
            type: 'String',
            value: `${tokenName}`,
        },
        {
            vname: 'symbol',
            type: 'String',
            value: `${symbol}`,
        },
        {
            vname: 'decimals',
            type: 'Uint32',
            value: `${decimals}`,
        },
        {
            vname: 'init_supply',
            type: 'Uint32',
            value: `${init_supply}`,
        },                 
      ];
    
    const code = read('./scillacodes/HUSD.scilla')

    return deployone(code, init, contractName);

}


// HEX 
// Hardcode HUSD address
// deployed with different gas numbers
 function deployHex(husdAddress) {

    const contractName = 'Hex';
    
    const initial_fee = '1000';

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'initial_owner',
          type: 'ByStr20',
          value: `${owner}`,
        },
        {
            vname: 'initial_fee',
            type: 'Uint256',
            value: `${initial_fee}`,
        },
      ];
    
    const stringToReplace = '0xad686d12e5326448f6dffdc11803276683b17d31';
    const code = read('./scillacodes/HEX.scilla').replace(stringToReplace, husdAddress);

    return deployone(code, init, contractName, hexGasPrice, hexGasLimit);

}


//Launcher
// Hardcode HUSD address
// Hardcode HEX address
 function deployLaunch(husdAddress, hexAddress, registerAddress) {

    const contractName = 'Launcher';

    const init =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'owner',
          type: 'ByStr20',
          value: `${owner}`,
        },
      ];
    
    // husd address
    const husdStringToReplace = '0xad686d12e5326448f6dffdc11803276683b17d31';
    const code2 = read('./scillacodes/Launcher.scilla').replace(husdStringToReplace, husdAddress);

    // hex address
    const hexStringToReplace = '0x01eae8b68aa35a9fe660aadbacbc2d5e392da018';
    const code1 = code2.replace(hexStringToReplace, hexAddress);

    // register 
    const registerStringToReplace = '0x01eae8b68aa35a9fe660aadbacbc2d5e392da018';
    const code = code1.replace(registerStringToReplace, registerAddress);

    return deployone(code, init, contractName, launchGasPrice, launchGasLimit);

}
