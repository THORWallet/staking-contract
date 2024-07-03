/*
  yarn deploy --script deploy-staking-joe-fork.js
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers, upgrades} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const rewardTokenAddress = "";
    const zgtAddress = "0x9BDd9140c95c4bFAa1FF21fF54802412452a330e";
    const feeCollector = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const ZGTStakingBasic = await ethers.getContractFactory("ZGTStakingBasic");
    const zgtStaking = await upgrades.deployProxy(ZGTStakingBasic, [zgtAddress, rewardTokenAddress, feeCollector, 0], {kind: 'transparent'});
    await zgtStaking.deployed();
    console.log("ZGT Staking deployed to:", await zgtStaking.address);

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: zgtStaking.address
    })

    console.log("Staking contract was verified successfully")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

