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

// config of the chain
const {chainId, msgVersion} = require('./config.json');
const VERSION = bytes.pack(chainId, msgVersion);

// Populate the wallet with an account
const {privateKey} = require('./secret.json');

zilliqa.wallet.addByPrivateKey(privateKey);

const address = getAddressFromPrivateKey(privateKey);
console.log(`My account address is: ${address}`);
console.log(`My account bech32 address is: ${toBech32Address(address)}`);


//  Hash address
const hashAddress = '0x2F78a58dee83E970aB36a0Cb5e5ce9a1331B179f';

async function genericDeploy() {
  try {
    // Get Balance
    const balance = await zilliqa.blockchain.getBalance(address);
    // Get Minimum Gas Price from blockchain
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice();

    // Account balance (See note 1)
    console.log(`Your account balance is:`);
    console.log(balance.result);
    console.log(`Current Minimum Gas Price: ${minGasPrice.result}`);
    const myGasPrice = units.toQa('2000', units.Units.Li); // Gas Price that will be used by all transactions
    console.log(`My Gas Price ${myGasPrice.toString()}`);
    const isGasSufficient = myGasPrice.gte(new BN(minGasPrice.result)); // Checks if your gas price is less than the minimum gas price
    console.log(`Is the gas price sufficient? ${isGasSufficient}`);

    // Deploy a contract
    console.log(`Deploying husd....`);
    const code = `scilla_version 0

    (***************************************************)
    (*               Associated library                *)
    (***************************************************)
    import IntUtils BoolUtils
    library FungibleToken
    
    let one_msg = 
      fun (msg : Message) => 
      let nil_msg = Nil {Message} in
      Cons {Message} msg nil_msg
    
    let two_msgs =
    fun (msg1 : Message) =>
    fun (msg2 : Message) =>
      let msgs_tmp = one_msg msg2 in
      Cons {Message} msg1 msgs_tmp
    
    (* Error events *)
    type Error =
    | CodeRecepientIsHash
    | CodeCallerNotHash
    | CodeInsufficientFunds
    | CodeInsufficientAllowance
    
    let make_error =
      fun (result : Error) =>
        let result_code = 
          match result with
          | CodeRecepientIsHash       => Int32 -1
          | CodeCallerNotHash         => Int32 -2
          | CodeInsufficientFunds     => Int32 -2
          | CodeInsufficientAllowance => Int32 -3
          end
        in
        { _exception : "Error"; code : result_code }
      
    let zero = Uint128 0
    let two = Uint128 2
    
    (* Dummy user-defined ADT *)
    type Unit =
    | Unit
    
    let get_val =
      fun (some_val: Option Uint128) =>
      match some_val with
      | Some val => val
      | None => zero
      end
    
    
    (***************************************************)
    (*             The contract definition             *)
    (***************************************************)
    
    contract FungibleToken
    (
      contract_owner: ByStr20,
      hash_address : ByStr20,  
      name : String,
      symbol: String,
      decimals: Uint32,
      init_supply : Uint128
    
    )
    
    (* Mutable fields *)
    field total_supply : Uint128 = init_supply
    
    field balances: Map ByStr20 Uint128 
      = let emp_map = Emp ByStr20 Uint128 in
        builtin put emp_map contract_owner init_supply
    
    field hashHusd : Uint128 = two
    
    (**************************************)
    (*             Procedures             *)
    (**************************************)
    
    procedure ThrowError(err : Error)
      e = make_error err;
      throw e
    end
    
    procedure RecepientNotHash(to: ByStr20)
      is_recepient_hash = builtin eq to hash_address;
      match is_recepient_hash with
      | True =>
        err = CodeRecepientIsHash;
        ThrowError err      
      | False =>
      end
    end
    
    procedure CallerIsHash()
      is_sender = builtin eq _sender hash_address;
      match is_sender with
      | True =>
      | False =>
        err = CodeCallerNotHash;
        ThrowError err      
      end
    end
    
    procedure AuthorizedMoveIfSufficientBalance(from: ByStr20, to: ByStr20, amount: Uint128)
      o_from_bal <- balances[from];
      bal = get_val o_from_bal;
      can_do = uint128_le amount bal;
      match can_do with
      | True =>
        (* Subtract amount from from and add it to to address *)
        new_from_bal = builtin sub bal amount;
        balances[from] := new_from_bal;
        (* Adds amount to to address *)
        get_to_bal <- balances[to];
        new_to_bal = match get_to_bal with
        | Some bal => builtin add bal amount
        | None => amount
        end;
        balances[to] := new_to_bal
      | False =>
        (* Balance not sufficient *)
        err = CodeInsufficientFunds;
        ThrowError err
      end
    end
    
    procedure Mint(to: ByStr20, amount: Uint128)
      
      total <- total_supply;
      new_total = builtin add total amount;
      total_supply := new_total;
      
      bal <- balances[to];
      inital_balance = get_val bal;
      final_balance = builtin add inital_balance amount;
      balances[to] := final_balance
      
    end
    
    procedure Burn(to: ByStr20, amount: Uint128)
      
      total <- total_supply;
      new_total = builtin sub total amount;
      total_supply := new_total;
      
      bal <- balances[to];
      inital_balance = get_val bal;
      final_balance = builtin sub inital_balance amount;
      balances[to] := final_balance
      
    end
    
    
    
    (***************************************)
    (*             Transitions             *)
    (***************************************)
    
    
    (* @dev: Moves an amount tokens from _sender to the recipient. Used by token_owner. *)
    (* @dev: Balance of recipient will increase. Balance of _sender will decrease.      *)
    (* @param to:  Address of the recipient whose balance is increased.                 *)
    (* @param amount:     Amount of tokens to be sent.                                  *)
    transition Transfer(to: ByStr20, amount: Uint128)
      (* used for all transactions other than to hash *)
      RecepientNotHash to;
      
      AuthorizedMoveIfSufficientBalance _sender to amount;
      e = {_eventname : "TransferSuccess"; sender : _sender; recipient : to; amount : amount};
      event e;
      (* Prevent sending to a contract address that does not support transfers of token *)
      msg_to_recipient = {_tag : "RecipientAcceptTransfer"; _recipient : to; _amount : zero; 
                          sender : _sender; recipient : to; amount : amount};
      msg_to_sender = {_tag : "TransferSuccessCallBack"; _recipient : _sender; _amount : zero; 
                      sender : _sender; recipient : to; amount : amount};
      msgs = two_msgs msg_to_recipient msg_to_sender;
      send msgs
    end
    
    transition RecipientAcceptTransfer(sender: ByStr20, recipient: ByStr20, amount: Uint128)
        CallerIsHash;
        rate <- hashHusd;
        converted_amount = builtin mul amount rate;
        Mint sender converted_amount;
        
        msg_to_recipient = {_tag : "hashTOhusd"; _recipient : sender; _amount : zero; 
                             hash : amount; husd : converted_amount};    
        msg = one_msg msg_to_recipient;
        send msg;
        
        e = {_eventname : "hashTOhusd"; sender : sender; hash : amount; husd : converted_amount};
        event e
        
    end
    
    transition ConvertToHash(amount: Uint128)
        bal <- balances[_sender];
        val = get_val bal;
        
        is_balance_enough = uint128_le amount val;
        match is_balance_enough with
        | True =>
          rate <- hashHusd;
          converted_amount = builtin div amount rate;
          Burn _sender amount;
          msg_to_hash = {_tag : "Transfer"; _recipient : hash_address; _amount : zero; 
                             to : _sender; amount : converted_amount};
          msg_to_recepient = {_tag : "husdTOhash"; _recipient : _sender; _amount : zero; 
                             husd :  amount ; hash : converted_amount};     
          msg = two_msgs msg_to_hash msg_to_recepient;
          send msg;
          
          e = {_eventname : "husdTOhash"; sender : _sender; husd : amount; hash : converted_amount};
          event e
          
        | False =>
          err = CodeInsufficientFunds;
          ThrowError err
        end
    end`;

    const init = [
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
        value: `${hashAddress}`,
      },      
      {
          vname: 'name',
          type: 'String',
          value: 'husd',
      },
      {
          vname: 'symbol',
          type: 'String',
          value: 'HUSD',
      },
      {
          vname: 'decimals',
          type: 'Uint32',
          value: '0',
      },
      {
          vname: 'init_supply',
          type: 'Uint128',
          value: '1000000000000000000000',
      },
    ];

    // Instance of class Contract
    const contract = zilliqa.contracts.new(code, init);

    // Deploy the contract.
    // Also notice here we have a default function parameter named toDs as mentioned above.
    // A contract can be deployed at either the shard or at the DS. Always set this value to false.
    const [deployTx, husd] = await contract.deploy(
      {
        version: VERSION,
        gasPrice: myGasPrice,
        gasLimit: Long.fromNumber(10000),
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
    console.log('The contract address is:');
    console.log(husd.address);
    //Following line added to fix issue https://github.com/Zilliqa/Zilliqa-JavaScript-Library/issues/168
    const deployedContract = zilliqa.contracts.at(husd.address);

  } catch (err) {
    console.log(err);
  }
}

genericDeploy();