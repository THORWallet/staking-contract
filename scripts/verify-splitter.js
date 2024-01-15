/*
  yarn deploy --script deploy-staking-mock.ts
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const Splitter = await ethers.getContractFactory("Splitter");

    const signers = await ethers.getSigners();

    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const splitter = await Splitter.attach('0xA31E676d69e361dD02b746722D4B267878cdd667');
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const tgtAddress = "0x108a850856Db3f85d0269a2693D896B394C80325";
    const treasury = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";
    const affiliateCollector = "0x23893CB95413af4eB2a8039fa2beD4048fED75f0";


    console.log('Splitter deployed to:', splitter.address);

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: splitter.address,
        constructorArguments: [tgtAddress,
            usdcAddress,
            [affiliateCollector,
                treasury],
            [utils.parseEther("0.5"),
                utils.parseEther("0.5")]],
    })

    console.log("Staking contract was verified successfully")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

