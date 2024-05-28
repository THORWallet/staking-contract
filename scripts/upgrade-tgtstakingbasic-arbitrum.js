/*
  yarn deploy --script deploy-staking-joe-fork.js
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers, upgrades} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const tgtAddress = "0x429fEd88f10285E61b12BDF00848315fbDfCC341";
    const feeCollector = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";
    const tgtStakingProxy = "0x6745c897ab1f4fdA9f7700e8Be6Ea2EE03672759";

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const TGTStakingBasic = await ethers.getContractFactory("TGTStakingBasic");


    const tgtStaking = await upgrades.forceImport(
        tgtStakingProxy,
        TGTStakingBasic,
        {kind: 'transparent'}
    )

    await upgrades.upgradeProxy(
        tgtStakingProxy,
        TGTStakingBasic,
        [tgtAddress, usdcAddress, feeCollector, 0], {kind: 'transparent'}
    );

    console.log("TGT Staking upgraded to:", await tgtStaking.address);

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

