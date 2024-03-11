/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('catapulta/hardhat');
require('@nomicfoundation/hardhat-verify');
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();
import {task} from "hardhat/config";
import "./tasks/bridge-bot";
import "./tasks/bridge-tx";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    // @ts-ignore
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
            forking: {
                url: "https://rpc.tenderly.co/fork/85dc06dc-9fee-40fe-bb74-1947cb8113e8",
            },
            accounts: {
                mnemonic: process.env.MNEMONIC
            }
        },
        polygon: {
            url: "https://polygon-pokt.nodies.app",
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            gasPrice: 200000000000
        },
        ethereum: {
            url: "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
            // url: "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            gasPrice: 58000000000
        },
        sepolia: {
            url: "https://11155111.rpc.thirdweb.com",
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            gasPrice: 25000000000
        },
        avax: {
            url: "https://api.avax.network/ext/bc/C/rpc",
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            gasPrice: 225000000000,
            chainId: 43114,
        },
        arbitrum: {
            url: "https://arb1.arbitrum.io/rpc",
            accounts: {
                mnemonic: process.env.MNEMONIC
            },
            chainId: 42161,
            maxFeePerGas: 2000000000,
            maxPriorityFeePerGas: 1500000000
        },
    },
    solidity: {
        compilers: [{
            version: "0.8.22",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 800
                }
            }
        },
            {
                version: "0.7.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 800
                    }
                }
            }
        ],
    },
    gasReporter: {
        currency: "USD",
        token: "ETH",
        gasPrice: 45,
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
