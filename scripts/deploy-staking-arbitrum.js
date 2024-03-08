/*
  yarn deploy --script deploy-staking.ts
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const TGTStaking = await ethers.getContractFactory("TGTStaking");

    usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    tgtAddress = "0x429fEd88f10285E61b12BDF00848315fbDfCC341";

    const signers = await ethers.getSigners();

    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const tgtStaking = await TGTStaking.deploy(
        usdcAddress,
        tgtAddress
    );

    console.log('TGTStaking deployed to:', tgtStaking.address);

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: tgtStaking.address,
        constructorArguments: [usdcAddress, tgtAddress],
    })

    console.log("Staking contract was verified successfully")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

