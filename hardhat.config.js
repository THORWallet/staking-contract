/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('catapulta/hardhat');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();


const {task} = require("hardhat/config");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            mining: {
                auto: true, // required to be able to run tests correctly
                interval: 0
            },
            accounts: {
                mnemonic: process.env.MNEMONIC
            }
        },
        polygon: {
            url: "https://rpc-mainnet.maticvigil.com",
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            gasPrice: 200000000000
        }
    },
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 800
            }
        }
    },

    gasReporter: {
        currency: "USD",
        token: "ETH",
        gasPrice: 15,
        // gasPriceApi:
        //     "https://api.etherscan.com/api?module=proxy&action=eth_gasPrice&apikey=" + process.env.ETHERSCAN_API_KEY,
        enabled: process.env.REPORT_GAS,
        excludeContracts: [],
        src: "./contracts",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    },

    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    }
};
