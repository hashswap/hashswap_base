const { BN, Long, bytes, units } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const {
  toBech32Address,
  getAddressFromPrivateKey,
} = require('@zilliqa-js/crypto');

const zilliqa = new Zilliqa('https://dev-api.zilliqa.com');

// These are set by the core protocol, and may vary per-chain.
// You can manually pack the bytes according to chain id and msg version.
// For more information: https://apidocs.zilliqa.com/?shell#getnetworkid

const chainId = 333; // chainId of the developer testnet
const msgVersion = 1; // current msgVersion
const VERSION = bytes.pack(chainId, msgVersion);

// Populate the wallet with an account
const privateKey =
  '5d99e6eb161b5a693934dacc6bd54d87d89bbb43ebda9d95f9cadcd322fcc862';

zilliqa.wallet.addByPrivateKey(privateKey);

const address = getAddressFromPrivateKey(privateKey);
console.log(`My account address is: ${address}`);
console.log(`My account bech32 address is: ${toBech32Address(address)}`);


const fs = require('fs');
// read a file and return contents as a string
function read(f)
{
  t = fs.readFileSync(f, 'utf8', (err,txt) => {
    if (err) throw err;
  });
  return t;
}

async function testBlockchain() {
  try {
    // Get Balance
    const balance = await zilliqa.blockchain.getBalance(address);
    // Get Minimum Gas Price from blockchain
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice();

    // Account balance (See note 1)
    console.log(`Your account balance is:`);
    console.log(balance.result);
    console.log(`Current Minimum Gas Price: ${minGasPrice.result}`);
    const myGasPrice = units.toQa('3000', units.Units.Li); // Gas Price that will be used by all transactions
    console.log(`My Gas Price ${myGasPrice.toString()}`);
    const isGasSufficient = myGasPrice.gte(new BN(minGasPrice.result)); // Checks if your gas price is less than the minimum gas price
    console.log(`Is the gas price sufficient? ${isGasSufficient}`);


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deploy Oracle
    console.log(`Deploying Oracle`);
    const code = read('./scillacodes/Oracle.scilla');

    // init for oracle
    const init = [
      // this parameter is mandatory for all init arrays
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
      {
        vname: 'owner',
        type: 'ByStr20',
        value: `${address}`,
      },
    ];

    // Instance of class Contract
    const contract = zilliqa.contracts.new(code, init);

    // Deploy the contract.
    // Also notice here we have a default function parameter named toDs as mentioned above.
    // A contract can be deployed at either the shard or at the DS. Always set this value to false.
    const [deployTx, oracle] = await contract.deploy(
      {
        version: VERSION,
        gasPrice: myGasPrice,
        gasLimit: Long.fromNumber(20000),
      },
      33,
      1000,
      false,
    );

    // Introspect the state of the underlying transaction
    console.log(`Deployment Transaction ID: ${deployTx.id}`);
    console.log(`Deployment Transaction Receipt:`);
    console.log(deployTx.txParams.receipt);

    // Get the deployed contract address
    console.log('The contract address is : ',oracle.address);
    const deployedOracle = zilliqa.contracts.at(oracle.address);


    console.log('\n');   

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // take the oracle address and deploy Register ---------------------------------------------------------------------------
    console.log('\n');
    console.log('Deploying Register - Oracle address hardcoded in the library');

    // read file and replace oracle address
    const code1 = read('./scillacodes/Register.scilla').replace('0x3396ee3eab04d3033c20474a3cb538ac7f6b4a18', oracle.address);

    // init for Register
    const init1 = [
      // this parameter is mandatory for all init arrays
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
      {
        vname: 'owner',
        type: 'ByStr20',
        value: `${address}`,
      },
    ];

   // Instance of class Contract
   const contract1 = zilliqa.contracts.new(code1, init1);

   // Deploy the contract.
   // Also notice here we have a default function parameter named toDs as mentioned above.
   // A contract can be deployed at either the shard or at the DS. Always set this value to false.
   const [deployTx1, register] = await contract1.deploy(
     {
       version: VERSION,
       gasPrice: myGasPrice,
       gasLimit: Long.fromNumber(20000),
     },
     33,
     1000,
     false,
   );

   // Introspect the state of the underlying transaction
   console.log(`Deployment Transaction ID: ${deployTx1.id}`);
   console.log(`Deployment Transaction Receipt:`);
   console.log(deployTx1.txParams.receipt);
   // Get the deployed contract address
   console.log('The contract address is : ',register.address);

   console.log('\n');   


   // SetRegisterOracle
   const deployedRegister = zilliqa.contracts.at(register.address);
   console.log('Calling Register transition SetRegisterOracle');
   const callTx = await deployedRegister.call(
      'SetRegisterOracle',
      [],
      {
        // amount, gasPrice and gasLimit must be explicitly provided
        version: VERSION,
        amount: new BN(0),
        gasPrice: myGasPrice,
        gasLimit: Long.fromNumber(8000),
      },
      33,
      1000,
      false,
    );  
    // Retrieving the transaction receipt (See note 2)
    console.log(JSON.stringify(callTx.receipt, null, 4));
        //Get the contract state
    console.log('Getting Oracle state...');
    const state = await deployedOracle.getState();
    console.log('The state of the Oracle:');
    console.log(JSON.stringify(state, null, 4));  


    console.log('\n');




    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deploy Hash ---------------------------------------------------------------------------
    console.log('\n');
    console.log('Deploying Hash');

    // read file and replace  address
    const code2 = read('./scillacodes/HASH.scilla');
    // init
    const tokenName = 'Hash';
    const symbol = 'HASH';
    const decimals = '10';
    const init_supply = '1000000000000000000';

    const init2 =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'contract_owner',
          type: 'ByStr20',
          value: `${address}`,
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
            type: 'Uint128',
            value: `${init_supply}`,
        },                 
      ];

   // Instance of class Contract
   const contract2 = zilliqa.contracts.new(code2, init2);

   // Deploy the contract.
   // Also notice here we have a default function parameter named toDs as mentioned above.
   // A contract can be deployed at either the shard or at the DS. Always set this value to false.
   const [deployTx2, hash] = await contract2.deploy(
     {
       version: VERSION,
       gasPrice: myGasPrice,
       gasLimit: Long.fromNumber(20000),
     },
     33,
     1000,
     false,
   );

   // Introspect the state of the underlying transaction
   console.log(`Deployment Transaction ID: ${deployTx2.id}`);
   console.log(`Deployment Transaction Receipt:`);
   console.log(deployTx2.txParams.receipt);   
   // Get the deployed contract address
   console.log('The contract address is : ',hash.address);

   console.log('\n'); 
  



   //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deploy Husd ---------------------------------------------------------------------------
    console.log('\n');
    console.log('Deploying Husd');

    // read file and replace  address
    const code3 = read('./scillacodes/HUSD.scilla');
    // init 
    const tokenName1 = 'Husd';
    const symbol1 = 'HUSD';
    const decimals1 = '10';
    const init_supply1 = '1000000000000000000';

    const init3 =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'contract_owner',
          type: 'ByStr20',
          value: `${address}`,
        },
        {
            vname: 'hash_address',
            type: 'ByStr20',
            value: `${hash.address}`,
          },        
        {
            vname: 'name',
            type: 'String',
            value: `${tokenName1}`,
        },
        {
            vname: 'symbol',
            type: 'String',
            value: `${symbol1}`,
        },
        {
            vname: 'decimals',
            type: 'Uint32',
            value: `${decimals1}`,
        },
        {
            vname: 'init_supply',
            type: 'Uint128',
            value: `${init_supply1}`,
        },                
      ];

   // Instance of class Contract
   const contract3 = zilliqa.contracts.new(code3, init3);

   // Deploy the contract.
   // Also notice here we have a default function parameter named toDs as mentioned above.
   // A contract can be deployed at either the shard or at the DS. Always set this value to false.
   const [deployTx3, husd] = await contract3.deploy(
     {
       version: VERSION,
       gasPrice: myGasPrice,
       gasLimit: Long.fromNumber(20000),
     },
     33,
     1000,
     false,
   );

   // Introspect the state of the underlying transaction
   console.log(`Deployment Transaction ID: ${deployTx3.id}`);
   console.log(`Deployment Transaction Receipt:`);
   console.log(deployTx3.txParams.receipt);   
   // Get the deployed contract address
   console.log('The contract address is : ',husd.address);

   console.log('\n');   








   //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deploy HEX ---------------------------------------------------------------------------
    console.log('\n');
    console.log('Deploying HEX');


    // read file and replace address
    const code4 = read('./scillacodes/HEX.scilla');
    const code4_mod1 = code4.replace('0xad686d12e5326448f6dffdc11803276683b17d31', husd.address);
    // init 
    
    const initial_fee = '1000';

    const init4 =  [
        // this parameter is mandatory for all init arrays
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: 'initial_owner',
          type: 'ByStr20',
          value: `${address}`,
        },
        {
            vname: 'initial_fee',
            type: 'Uint256',
            value: `${initial_fee}`,
        },
      ];

   // Instance of class Contract
   const contract4 = zilliqa.contracts.new(code4_mod1, init4);

   // Deploy the contract.
   // Also notice here we have a default function parameter named toDs as mentioned above.
   // A contract can be deployed at either the shard or at the DS. Always set this value to false.
   const [deployTx4, hex] = await contract4.deploy(
     {
       version: VERSION,
       gasPrice: myGasPrice,
       gasLimit: Long.fromNumber(33000),
     },
     33,
     1000,
     false,
   );

   // Introspect the state of the underlying transaction
   console.log(`Deployment Transaction ID: ${deployTx4.id}`);
   console.log(`Deployment Transaction Receipt:`);
   console.log(deployTx4.txParams.receipt);   
   // Get the deployed contract address
   console.log('The contract address is : ',hex.address);

  





   //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deploy Launcher ---------------------------------------------------------------------------
    console.log('\n');
    console.log('Deploying Launcher');


    // read file and replace  address
    const code5 = read('./scillacodes/Launcher.scilla');
    const code5_mod1 = code5.replace('0xc09e3c596804fd591a440acc83d165fb01235d42', register.address);
    const code5_mod2 = code5_mod1.replace('0xad686d12e5326448f6dffdc11803276683b17d31', husd.address);
    const code5_mod3 = code5_mod2.replace('0x01eae8b68aa35a9fe660aadbacbc2d5e392da018', hex.address);
  
  
    

    const init5 =  [
      // this parameter is mandatory for all init arrays
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
      {
        vname: 'owner',
        type: 'ByStr20',
        value: `${address}`,
      },
    ];

   // Instance of class Contract
   const contract5 = zilliqa.contracts.new(code5_mod3, init5);

   // Deploy the contract.
   // Also notice here we have a default function parameter named toDs as mentioned above.
   // A contract can be deployed at either the shard or at the DS. Always set this value to false.
   const [deployTx5, launch] = await contract5.deploy(
     {
       version: VERSION,
       gasPrice: myGasPrice,
       gasLimit: Long.fromNumber(50000),
     },
     33,
     1000,
     false,
   );

   // Introspect the state of the underlying transaction
   console.log(`Deployment Transaction ID: ${deployTx5.id}`);
   console.log(`Deployment Transaction Receipt:`);
   console.log(deployTx5.txParams.receipt);   
   // Get the deployed contract address
   console.log('The contract address is : ',launch.address);

   console.log('\n');

   console.log('All contracts launched\n')
  } catch (err) {
    console.log(err);
  }
}

testBlockchain();
