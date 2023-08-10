# TGT Staking Contract


## THORWallet Governance Token (TGT) Staking Contract

The contract is a staking contract based on TradersJoe staking contract with the following additions:

* Time based staking multiplier 
  * Users who stake for longer periods of time will receive a higher multiplier
  * The multiplier is calculated based on the following formula:
    * timeStaked < 7 days  = 0
    * timeStaked > 7 days  = 0.5x
    * timeStaked > 6 months = 0.75x
    * timeStaked > 1 year = 1x
* The contract also has a treasury account that receives a percentage of the rewards
  * The owner can set an arbitrary percentage of the rewards to be sent to the treasury account

Forked contract is StableJoeStaking.sol
https://github.com/traderjoe-xyz/joe-core/blob/main/contracts/StableJoeStaking.sol


  

## Installation and Running Tests

Run the following commands on the freshly cloned repository:

```
yarn
yarn test
```
