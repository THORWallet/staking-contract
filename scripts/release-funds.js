const hre = require("hardhat");
const {utils, getDefaultProvider} = require("ethers");
const {ethers} = require("hardhat");
const {getCurrentTimestamp} = require("hardhat/internal/hardhat-network/provider/utils/getCurrentTimestamp");
require("dotenv").config();
let lastWithdrawalTimestamp = 0;

async function main() {
    getDefaultProvider().on("block", async () => {
        console.log("Listening new block, waiting..)");

        console.log(`Running release funds script for the splitter contract`)

        const signers = await ethers.getSigners();
        const deployer = signers[0];
        console.log('Bot address: ' + (await deployer.getAddress()));

        const Splitter = await ethers.getContractFactory("Splitter");
        const splitter = await Splitter.attach('0x62e26f6f7B253dDA4e2899eC7A85886D3041347c');

        usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        tgtAddress = "0x108a850856Db3f85d0269a2693D896B394C80325";

        const tgt = await ethers.getContractAt("contracts/mocks/TGT.sol:TGT", tgtAddress);
        const usdc = await ethers.getContractAt("USDC", usdcAddress);

        const tgtBalance = await tgt.balanceOf(splitter.address);
        const usdcBalance = await usdc.balanceOf(splitter.address);

        console.log("TGT balance of the Splitter contract: " + ethers.utils.formatUnits(tgtBalance, 18));
        console.log("USDC balance of the Splitter contract: " + ethers.utils.formatUnits(usdcBalance, 6));

        //Checks for a release of funds only after 12 hours of the last withdrawal
        if (getCurrentTimestamp() > lastWithdrawalTimestamp + (12 * 3600)) {
            //Triggers a release of funds if the balance of the Splitter contract is greater than 2000 TGT or 20 USDC
            if (tgtBalance.gt(ethers.utils.parseUnits("2000"), 18) || usdcBalance.gt(ethers.utils.parseUnits("20", 6))) {
                if (tgtBalance.gt(0) && usdcBalance.gt(0)) {
                    console.log("Releasing funds");
                    const tx = await splitter.releaseAllFunds();
                    console.log("Funds release executed successfully: " + tx.hash);
                } else {
                    if (tgtBalance.gt(0)) {
                        console.log("Releasing TGT funds");
                        const tx = await splitter.releaseTgtFunds();
                        console.log("TGT funds release executed successfully: " + tx.hash);
                    }
                    if (usdcBalance.gt(0)) {
                        console.log("Releasing USDC funds");
                        const tx = await splitter.releaseUsdcFunds();
                        console.log("USDC funds release executed successfully: " + tx.hash);
                    }
                }
                lastWithdrawalTimestamp = getCurrentTimestamp();
            } else {
                console.log("No funds to release");
            }
        } else {
            console.log("The last withdrawal was less than 12 hours ago");
        }
    })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});