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
    const TGTFactory = await ethers.getContractFactory("MockTGT");
    const USDC = await ethers.getContractFactory("USDC");

    const signers = await ethers.getSigners();

    const deployer = signers[0];
    console.log('Deployer address: ' + (await deployer.getAddress()));

    const rewardToken = await USDC.deploy();
    console.log('Reward token deployed to:', rewardToken.address);

    const tgt = await TGTFactory.deploy();
    console.log('TGT deployed to:', tgt.address);

    const accounts = [
        "0x8745BE2c582BCFC50ACF9d2C61CadEd65a4E3825",
        "0xf6aEB9C3dde78D585DC8A3dFa1aEE4265615457c",
        "0x143a044e497624f46a0f1e35847ecf2400a0d3df",
        "0x1eba67dad8441d516f9b8d8c954960bb147d4559",
        "0x400fc9c7f01df3aa919659de434e0c584e68cb29",
        "0x9Cca88385bE131a716f6224c77A7BCcf42fF2F8d",
        "0x2aa6863228178ba68f9f30e3ed7528811843d964"
    ];

    const amounts = [
        utils.parseEther("100"),
        utils.parseEther("100"),
        utils.parseEther("100"),
        utils.parseEther("100"),
        utils.parseEther("1000"),
        utils.parseEther("100"),
        utils.parseEther("100"),
    ];

    await tgt.mint(accounts, amounts);
    await tgt.mintFinish();

    console.log('TGT minted to:', accounts);

    const tgtStaking = await TGTStaking.deploy(
        rewardToken.address,
        tgt.address
    );

    console.log('TGTStaking deployed to:', tgtStaking.address);

    await rewardToken.mint(
        tgtStaking.address,
        utils.parseUnits("1000", 6)
    );

    await rewardToken.mint(
        "0x400Fc9C7F01Df3aa919659De434E0c584e68CB29",
        utils.parseUnits("10000", 6)
    );

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: tgtStaking.address,
        constructorArguments: [rewardToken.address, tgt.address],
    })

    console.log("Staking was verified successfully")

    await hre.run("verify:verify", {
        address: tgt.address,
        constructorArguments: [],
    })

    await hre.run("verify:verify", {
        address: rewardToken.address,
        constructorArguments: [],
    })

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

