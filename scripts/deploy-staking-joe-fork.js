/*
  yarn deploy --script deploy-staking-joe-fork.js
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers, upgrades} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const tgtAddress = "0x108a850856Db3f85d0269a2693D896B394C80325";
    const feeCollector = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const TGTStakingBasic = await ethers.getContractFactory("TGTStakingBasic");
    const tgtStaking = await upgrades.deployProxy(TGTStakingBasic, [tgtAddress, usdcAddress, feeCollector, 0], {kind: 'transparent'});
    await tgtStaking.deployed();
    console.log("TGT Staking deployed to:", await tgtStaking.address);

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: tgtStaking.address
    })

    console.log("Staking contract was verified successfully")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

