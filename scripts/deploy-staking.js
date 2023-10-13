/*
  yarn deploy --script deploy-staking-mock.ts
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the staking contract`)

    const TGTStaking = await ethers.getContractFactory("TGTStaking");

    usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    tgtAddress = "0x108a850856Db3f85d0269a2693D896B394C80325";

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

