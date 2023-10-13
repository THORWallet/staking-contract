const {expect} = require("chai");
const {network, ethers} = require("hardhat");

const {loadFixture} = require("@nomicfoundation/hardhat-network-helpers");

const hre = require("hardhat");
const {utils} = require("ethers");

describe("TGT Vesting", function () {

    async function deployFixture() {
        const TGTVesting = await ethers.getContractFactory("TGTVesting");
        const TGTFactory = await ethers.getContractFactory("MockTGT");

        const signers = await ethers.getSigners();
        const dev = signers[0];
        const alice = signers[1];
        const bob = signers[2];

        const tgt = await TGTFactory.deploy();

        const accounts = [alice.address, bob.address, dev.address];
        const amounts = [utils.parseEther("1000"),
            utils.parseEther("1000"),
            utils.parseEther("1000")];
        await tgt.mint(accounts, amounts);
        await tgt.mintFinish();

        const block = await ethers.provider.getBlock("latest");

        const tgtVesting = await TGTVesting.deploy(
            tgt.address,
            block.timestamp,
            30
        );

        await tgt.connect(alice).approve(tgtVesting.address, utils.parseEther("100000"));
        await tgt.connect(dev).transfer(tgtVesting.address, utils.parseEther("100"));
        return {
            tgtVesting,
            tgt,
            dev,
            alice,
            bob
        };
    }

    describe("should allow vesting and claims", function () {


        it("should be able to claim after the tokens have vested", async function () {
            const {
                tgtVesting,
                tgt,
                rewardToken,
                dev,
                alice,
                bob,
                carol
            } = await loadFixture(deployFixture);

            await tgtVesting.connect(dev).vest([alice.address], [utils.parseEther("100")]);
            await expect(tgtVesting.connect(alice).claim(alice.address, utils.parseEther("100"))).to.be.reverted;
            increase(30);
            await expect(tgtVesting.connect(alice).claim(alice.address, utils.parseEther("200"))).to.be.reverted;

            await tgtVesting.connect(alice).claim(alice.address, utils.parseEther("100"));
            //
            // expect(await tgt.balanceOf(alice.address)).to.be.equal(utils.parseEther("900"));
            // expect(
            //     await tgt.balanceOf(tgtVesting.address)
            // ).to.be.equal(utils.parseEther("100"));
            //
            //
            // await tgtVesting.connect(bob).deposit(utils.parseEther("200"));
            // expect(await tgt.balanceOf(bob.address)).to.be.equal(utils.parseEther("800"));
            // expect(await tgt.balanceOf(tgtVesting.address)).to.be.equal(utils.parseEther("300"));
            //
            // await tgtVesting.connect(carol).deposit(utils.parseEther("300"));
            //
            // expect(await tgt.balanceOf(carol.address)).to.be.equal(utils.parseEther("700"));
            // // 291 + 300 * 0.97
            // expect(await tgt.balanceOf(tgtVesting.address)
            // ).to.be.equal(utils.parseEther("600"));
            //
            // await tgtVesting.connect(alice).withdraw(utils.parseEther("100"));
            // expect(await tgt.balanceOf(alice.address)).to.be.equal(
            //     utils.parseEther("1000")
            // );
            // expect(await tgt.balanceOf(tgtVesting.address)).to.be.equal(utils.parseEther("500"));
            // expect((await tgtVesting.getUserInfo(alice.address, tgt.address))[0]).to.be.equal(0);
            //
            // expect(await tgt.balanceOf(carol.address)).to.be.equal(utils.parseEther("800"));
            // expect(await tgt.balanceOf(tgtVesting.address)).to.be.equal(utils.parseEther("400"));
            //
            // await tgtVesting.connect(bob).withdraw("1");
            //
            // expect(await tgt.balanceOf(bob.address)).to.be.closeTo(
            //     utils.parseEther("800"), utils.parseEther("0.0001")
            // );
            // expect(await tgt.balanceOf(tgtVesting.address)).to.be.closeTo(
            //     utils.parseEther("400"), utils.parseEther("0.0001")
            // );

        });

    });

    after(async function () {
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        });
    });
})
;

const increase = (seconds) => {
    ethers.provider.send("evm_increaseTime", [seconds]);
    ethers.provider.send("evm_mine", []);
};