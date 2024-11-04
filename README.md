# tgc_blockchain

## Prerequisites and Installation

### Prerequisites

- Ensure you have [Node.js](https://nodejs.org) installed on your machine.

- For a deeper understanding of the development environment, refer to [Hardhat's documentation](https://hardhat.org/hardhat-runner/docs/getting-started#overview).

### Installing Dependencies

All the required dependencies for this project are listed in the `package.json` file. To install them, simply run:

```
npm install
```

## Contract Compilation

To compile the smart contract, follow these steps:


1. Run the compilation command:
   ```
   npx hardhat compile
   ```
2. The compiled artifacts will be stored in a folder called `artifacts`. You can now move on to deploying or testing this contract.

## Running Tests

1. Execute the following command to run the tests:

   ```
   npx hardhat test --network hardhat
   ```

## Deploying Contract

To deploy contract follow these steps:

1. Create .env file using .env.template file and fill the values properly

2. Compile Contract using:
   ```
   npx hardhat compile
   ```

3. Deploy:

   network name is stored in `hardhat.config.js`
   ```
   npx hardhat run scripts/deploy.js --network <network_name>
   ```

## Veryfing Contracts

Smart Contracts should be verified in order to make local scripts works

1. Make sure your .env is filled properly

2. Deploy Contract

3. Fill deployed contracts addresses in .env

4. To verify contract follow these steps:
   
   network name is stored in `hardhat.config.js`

   ```
   npx hardhat verify --network <network_name> DEPLOYED_CONTRACT_ADDRESS
   ```


## Polygon Amoy:

In TGC Project we use Polygon Amoy Testnet for test deployment of our NFT's.

In order to deploy contracts to testnet you need to have MATIC Coin in your wallet.

1. Firstly you have to add Polygon Amoy NET to you Metamask
   ```
   https://revoke.cash/learn/wallets/add-network/polygon-amoy
   ```
2. Next you have to obtain MATIC Coin
   ```
   https://faucet.polygon.technology/
   ```
3. Now you should have some MATIC Coin in your wallet to deploy and make operations with deployed tokens