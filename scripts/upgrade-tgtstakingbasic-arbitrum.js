/*
  yarn deploy --script upgrade-tgtstakingbasic-arbitrum.js --network arbitrumLedger
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

    //these are two random depositors to the pending rewards are the same after the upgrade
    const alice = "0x55459ec19cf863732532795525d03a61089819ed";
    const bob = "0x012Ab5Affb6dB7EA90E89fa7d59445673840e5dc";

    console.log('Deployer address: ' + (await deployer.getAddress()));

    const TGTStakingBasic = await ethers.getContractFactory("TGTStakingBasic");

    const snapshotId = await hre.network.provider.send("evm_snapshot");
    console.log(`Snapshot taken with id: ${snapshotId}`);

    const tgtStaking = await upgrades.forceImport(
        tgtStakingProxy,
        TGTStakingBasic,
        {kind: 'transparent'}
    )

    console.log("Pending reward balance for Alice: ", utils.formatUnits(await tgtStaking.pendingReward(alice, usdcAddress), 6));
    console.log("Pending reward balance for Bob: ", utils.formatUnits(await tgtStaking.pendingReward(bob, usdcAddress), 6));

    await upgrades.upgradeProxy(
        tgtStakingProxy,
        TGTStakingBasic,
        [tgtAddress, usdcAddress, feeCollector, 0], {kind: 'transparent'}
    );

    console.log("TGT Staking upgraded to:", await tgtStaking.address);

    console.log("Pending reward balance for Alice: ", utils.formatUnits(await tgtStaking.pendingReward(alice, usdcAddress), 6));
    console.log("Pending reward balance for Bob: ", utils.formatUnits(await tgtStaking.pendingReward(bob, usdcAddress), 6));

    //delay for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run("verify:verify", {
        address: tgtStaking.address
    })

    console.log("Staking contract was verified successfully")

    //Revert to snapshot to test the upgrade again
    await hre.network.provider.send("evm_revert", [snapshotId]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

