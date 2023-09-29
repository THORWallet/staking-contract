/*
  yarn deploy --script deploy-splitter.js
*/


const hre = require("hardhat");
const {utils} = require("ethers");
const {ethers} = require("hardhat");
require("dotenv").config();

async function main() {

    console.log(`Running deploy script for the payment splitter contract`)
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const treasury = signers[1];
    console.log('Deployer address: ' + (await deployer.getAddress()));


    const Splitter = await ethers.getContractFactory("Splitter");
    const TGTStaking = await ethers.getContractFactory("TGTStaking");
    const TGT = await ethers.getContractFactory("MockTGT");
    const USDC = await ethers.getContractFactory("USDC");

    const tgt = TGT.attach("0x57ac959322Fb581f301CFC0Ee5B4adeBfced7b91");
    const usdc = USDC.attach("0x4f165f29C42632B40187DfA70355A14fa56b217a");
    const staking = TGTStaking.attach("0x69DDECAE7c9E6Ca0e836EBdC1Cb15330423Afec9");

    const splitter = await Splitter.deploy(
        tgt.address,
        usdc.address,
        [staking.address,
            treasury.address],
        [utils.parseEther("0.5"),
            utils.parseEther("0.5")]
    );

    console.log('Splitter deployed to:', splitter.address);


    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: splitter.address,
        constructorArguments: [tgt.address,
            usdc.address,
            [staking.address,
                treasury.address],
            [utils.parseEther("0.5"),
                utils.parseEther("0.5")]],
    })


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

