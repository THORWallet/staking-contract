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
    const treasury = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const Splitter = await ethers.getContractFactory("Splitter");
    const TGTStakingBasic = await ethers.getContractFactory("TGTStakingBasic");
    const TGT = await ethers.getContractFactory("MockTGT");
    const USDC = await ethers.getContractFactory("USDC");

    const tgt = TGT.attach("0x108a850856Db3f85d0269a2693D896B394C80325");
    const usdc = USDC.attach("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E");
    const tokenMessenger = "0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982";
    const staking = TGTStakingBasic.attach("0x6745c897ab1f4fdA9f7700e8Be6Ea2EE03672759");

    console.log("Deploying splitter contract");

    const splitter = await Splitter.deploy(
        tgt.address,
        usdc.address,
        [staking.address, treasury],
        [utils.parseEther("0.5"), utils.parseEther("0.5")],
        tokenMessenger,
        staking.address
    );

    console.log('Splitter deployed to:', splitter.address);

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: splitter.address,
        constructorArguments: [tgt.address,
            usdc.address,
            [staking.address, treasury],
            [utils.parseEther("0.5"), utils.parseEther("0.5")],
            tokenMessenger,
            staking.address
        ],
    })

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
