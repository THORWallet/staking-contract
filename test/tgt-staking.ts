const {expect} = require("chai");
const {network, ethers, upgrades} = require("hardhat");

const {loadFixture} = require("@nomicfoundation/hardhat-network-helpers");

const hre = require("hardhat");
const {utils} = require("ethers");

describe("TGT Staking", function () {

    async function deployFixture() {
        const TGTStaking = await ethers.getContractFactory("TGTStaking");
        const TGTStakingBasic = await ethers.getContractFactory("TGTStakingBasic");
        const TGTFactory = await ethers.getContractFactory("MockTGT");
        const StableJoeStaking = await ethers.getContractFactory("StableJoeStaking");
        const USDC = await ethers.getContractFactory("USDC");

        const signers = await ethers.getSigners();
        const dev = signers[0];
        const alice = signers[1];
        const bob = signers[2];
        const carol = signers[3];
        const tgtMaker = signers[4];
        const joe = signers[5];
        const treasury = signers[6];

        const rewardToken = await USDC.deploy();
        const tgt = await TGTFactory.deploy();

        const accounts = [alice.address, bob.address, carol.address, dev.address, tgtMaker.address, joe.address];
        const amounts = [utils.parseEther("1000"),
            utils.parseEther("1000"),
            utils.parseEther("1000"),
            utils.parseEther("0"),
            utils.parseEther("1500000"),
            utils.parseEther("10000")];
        await tgt.mint(accounts, amounts);
        await tgt.mintFinish();

        await rewardToken.mint(
            tgtMaker.address,
            utils.parseEther("1000000")
        ); // 1_000_000 tokens

        const tgtStaking = await TGTStaking.deploy(
            rewardToken.address,
            tgt.address
        );

        const tgtStakingBasic = await upgrades.deployProxy(TGTStakingBasic,
            [tgt.address, rewardToken.address, treasury.address, 0]
        );

        const joeStaking = await upgrades.deployProxy(StableJoeStaking, [rewardToken.address, joe.address, 0],
            {
                unsafeAllow: ["constructor", "state-variable-immutable"],
                constructorArgs: [tgt.address],
            });

        console.log("USDC decimals is: " + (await rewardToken.decimals()).toString());

        await tgt.connect(alice).approve(tgtStaking.address, utils.parseEther("360000"));
        await tgt.connect(bob).approve(tgtStaking.address, utils.parseEther("360000"));
        await tgt.connect(carol).approve(tgtStaking.address, utils.parseEther("100000"));
        await tgt.connect(joe).approve(tgtStaking.address, utils.parseEther("100000"));

        await tgt.connect(alice).approve(tgtStakingBasic.address, utils.parseEther("360000"));
        await tgt.connect(bob).approve(tgtStakingBasic.address, utils.parseEther("360000"));
        await tgt.connect(carol).approve(tgtStakingBasic.address, utils.parseEther("100000"));
        await tgt.connect(joe).approve(tgtStakingBasic.address, utils.parseEther("100000"));

        await tgt.connect(alice).approve(joeStaking.address, utils.parseEther("100000"));
        await tgt.connect(bob).approve(joeStaking.address, utils.parseEther("100000"));
        await tgt.connect(carol).approve(joeStaking.address, utils.parseEther("100000"));
        await tgt.connect(joe).approve(joeStaking.address, utils.parseEther("100000"));

        return {
            tgtStaking,
            tgt,
            rewardToken,
            dev,
            alice,
            bob,
            carol,
            tgtMaker,
            USDC,
            joe,
            joeStaking,
            tgtStakingBasic
        };
    }

    describe("should allow deposits and withdraws", function () {

        it("should allow deposits and withdraws of multiple users", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                dev,
                alice,
                bob,
                carol
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));

            expect(await tgt.balanceOf(alice.address)).to.be.equal(utils.parseEther("900"));
            expect(
                await tgt.balanceOf(tgtStaking.address)
            ).to.be.equal(utils.parseEther("100"));
            // 100 * 0.97 = 97
            expect((await tgtStaking.getUserInfo(
                alice.address,
                tgt.address))[0]
            ).to.be.equal(utils.parseEther("100"));

            await tgtStaking.connect(bob).deposit(utils.parseEther("200"));
            expect(await tgt.balanceOf(bob.address)).to.be.equal(
                utils.parseEther("800")
                // 97 + 200 * 0.97 = 291
            );
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("300"));
            expect((await tgtStaking.getUserInfo(bob.address, tgt.address))[0]).to.be.equal(utils.parseEther("200"));

            await tgtStaking
                .connect(carol)
                .deposit(utils.parseEther("300"));
            expect(await tgt.balanceOf(carol.address)).to.be.equal(
                utils.parseEther("700")
            );
            // 291 + 300 * 0.97
            expect(await tgt.balanceOf(tgtStaking.address)
            ).to.be.equal(utils.parseEther("600"));
            expect((await tgtStaking.getUserInfo(carol.address, tgt.address))[0]
            ).to.be.equal(utils.parseEther("300"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("100"));
            expect(await tgt.balanceOf(alice.address)).to.be.equal(
                utils.parseEther("1000")
            );
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("500"));
            expect((await tgtStaking.getUserInfo(alice.address, tgt.address))[0]).to.be.equal(0);

            await tgtStaking.connect(carol).withdraw(utils.parseEther("100"));
            expect(await tgt.balanceOf(carol.address)).to.be.equal(utils.parseEther("800"));
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("400"));
            expect((await tgtStaking.getUserInfo(carol.address, tgt.address))[0]).to.be.equal(utils.parseEther("200"));

            await tgtStaking.connect(bob).withdraw("1");

            expect(await tgt.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("800"), utils.parseEther("0.0001")
            );
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.closeTo(
                utils.parseEther("400"), utils.parseEther("0.0001")
            );
            expect((await tgtStaking.getUserInfo(bob.address, tgt.address))[0]).to.be.closeTo(
                utils.parseEther("200"), utils.parseEther("0.0001")
            );
        });

        it("should update variables accordingly", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit("1");

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1"));

            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("1"));
            expect(await tgtStaking.lastRewardBalance(rewardToken.address)).to.be.equal("0");

            //increase to 7 days, as staking multiplier is 1x then.
            await increase(86400 * 7);

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.closeTo(
                utils.parseEther("0.5"),
                utils.parseEther("0.0001")
            );

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1"));

            expect(
                await tgtStaking.pendingReward(alice.address, rewardToken.address)
            ).to.be.closeTo(utils.parseEther("1"), utils.parseEther("0.0001"));

        });

        it("should return rewards with staking multiplier accordingly", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit("1");

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1"));

            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("1"));
            expect(await tgtStaking.lastRewardBalance(rewardToken.address)).to.be.equal("0");

            //increase to 7 days, as staking multiplier is 1x then.
            await increase(86400 * 7);
            console.log("Staking multiplier is now: " + (await tgtStaking.getStakingMultiplier(alice.address)).toString());
            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.closeTo(utils.parseEther("0.5"), utils.parseEther("0.0001"));

            // Making sure that `pendingReward` still return the accurate tokens even after updating pools
            expect(
                await tgtStaking.pendingReward(
                    alice.address,
                    rewardToken.address
                )
            ).to.be.closeTo(utils.parseEther("0.5"), utils.parseEther("0.0001"));

            //increase to 6 months, as staking multiplier is 1.5x then.
            await increase((86400 * 30 * 6) - (86400 * 7));
            // console.log("Staking multiplier is now: " + (await tgtStaking.getStakingMultiplier(alice.address)).toString());
            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.closeTo(utils.parseEther("0.75"), utils.parseEther("0.0001"));

            //increase to 1 year, as staking multiplier is 2x then.
            await increase(86400 * 185);
            // console.log("Staking multiplier is now: " + (await tgtStaking.getStakingMultiplier(alice.address)).toString());
            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.closeTo(utils.parseEther("1"), utils.parseEther("0.0001"));

            // Making sure that `pendingReward` still return the accurate tokens even after updating pools
            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)
            ).to.be.closeTo(utils.parseEther("1"), utils.parseEther("0.0001"));

        });

        it("should allow deposits and withdraws of multiple users and distribute rewards accordingly", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("200"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("300"));
            // console.log("Staking multiplier is now: " + (await tgtStaking.getStakingMultiplier(alice.address)).toString());
            await increase(86400 * 7);
            // console.log("Staking multiplier is now: " + (await tgtStaking.getStakingMultiplier(alice.address)).toString());

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("6"));
            // console.log("Reward pool balance: " + (await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Alice reward balance before claiming: " + (await rewardToken.balanceOf(alice.address)).toString());
            await tgtStaking.connect(alice).withdraw(utils.parseEther("97"));
            // console.log("Alice reward after: " + (await rewardToken.balanceOf(alice.address)).toString());

            // accRewardBalance = rewardBalance * PRECISION / totalStaked
            //                  = 6e18 * 1e24 / 582e18
            //                  = 0.010309278350515463917525e24
            // reward = accRewardBalance * aliceShare / PRECISION
            //        = accRewardBalance * 97e18 / 1e24
            //        = 0.999999999999999999e18

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("0.5"),
                utils.parseEther("0.0001")
            );

            await tgtStaking.connect(carol).withdraw(utils.parseEther("100"));
            expect(await tgt.balanceOf(carol.address)).to.be.equal(utils.parseEther("800"));
            // reward = accRewardBalance * carolShare / PRECISION
            //        = accRewardBalance * 291e18 / 1e24
            //        = 2.999999999999999999e18
            expect(
                await rewardToken.balanceOf(carol.address)
            ).to.be.closeTo(
                utils.parseEther("1.5"),
                utils.parseEther("0.001")
            );

            await tgtStaking.connect(bob).withdraw("0");
            // reward = accRewardBalance * carolShare / PRECISION
            //        = accRewardBalance * 194e18 / 1e24
            //        = 1.999999999999999999e18
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("1"),
                utils.parseEther("0.001")
            );
        });

        it("should distribute token accordingly even if update isn't called every day", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                tgtMaker,
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(1);
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(0);

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1"));
            await increase(7 * 86400);
            await tgtStaking.connect(alice).withdraw(0);
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(utils.parseEther("0.5"), utils.parseEther("0.0001"));

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1"));
            await tgtStaking.connect(alice).withdraw(0);
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(utils.parseEther("1"), utils.parseEther("0.0001"));
        });

        it("should allow deposits and withdraws of multiple users and distribute rewards accordingly even if someone enters or leaves", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("100"));

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            await increase(86400 * 7);

            await tgtStaking.connect(bob).deposit(utils.parseEther("1000")); // Bob enters

            console.log("Reward pool balance: " + (await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.001")
            );

            await tgtStaking.connect(carol).withdraw(utils.parseEther("100"));

            expect(await rewardToken.balanceOf(carol.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.0001")
            );

            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Pending reward for Alice: " + utils.formatEther(await tgtStaking.pendingReward(alice.address, rewardToken.address)));

            // Alice enters again to try to get more rewards
            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));

            console.log("Pending reward for Alice: " + utils.formatEther(await tgtStaking.pendingReward(alice.address, rewardToken.address)));
            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());

            await tgtStaking.connect(alice).withdraw(utils.parseEther("200"));
            // She gets the same reward as Carol
            const lastAliceBalance = await rewardToken.balanceOf(alice.address);

            expect(lastAliceBalance).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.001")
            );
            await increase(86400 * 7);

            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^-");
            // Reward pool should have enough tokens to pay Bob
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

            console.log("Staking deposit for Alice: " + (await tgtStaking.getUserInfo(alice.address, rewardToken.address))[0]);
            console.log("Staking deposit for Carol: " + (await tgtStaking.getUserInfo(carol.address, rewardToken.address))[0]);
            console.log("Staking deposit for Bob: " + (await tgtStaking.getUserInfo(bob.address, rewardToken.address))[0]);

            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());

            await tgtStaking.connect(bob).withdraw("0");

            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.001")
            );

            // Alice shouldn't receive any token of the last reward
            await tgtStaking.connect(alice).withdraw("0");
            // reward = accRewardBalance * aliceShare / PRECISION - aliceRewardDebt
            //        = accRewardBalance * 0 / PRECISION - 0
            //        = 0      (she withdrew everything, so her share is 0)
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(lastAliceBalance);

            console.log("--------------------------------------");
            console.log("Reward pool balance at the end: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("--------------------------------------");
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Staking deposit for Alice: " + (await tgtStaking.getUserInfo(alice.address, rewardToken.address))[0]);
            console.log("Reward balance for Alice at the end: " + utils.formatEther(await rewardToken.balanceOf(alice.address)).toString());
            console.log("Pending reward for Alice: " + utils.formatEther(await tgtStaking.pendingReward(alice.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Staking deposit for Bob: " + (await tgtStaking.getUserInfo(bob.address, rewardToken.address))[0]);
            console.log("Reward balance for Bob at the end: " + utils.formatEther(await rewardToken.balanceOf(bob.address)).toString());
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Staking deposit for Carol: " + (await tgtStaking.getUserInfo(carol.address, rewardToken.address))[0]);
            console.log("Reward balance for Carol at the end: " + utils.formatEther(await rewardToken.balanceOf(carol.address)).toString());
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));

            increase(86400 * 365);
            console.log("*** 1 year passed ***");
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("Reward pool balance before last withdraw: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());

            // Reward pool should have enough tokens to pay Bob but there should still be a reward to pay to Bob
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

            await tgtStaking.connect(bob).withdraw(0);

            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("Reward pool balance at the end: " + utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Reward balance for Bob at the end: " + utils.formatEther(await rewardToken.balanceOf(bob.address)).toString());

            //FIXME TODO there are funds to be redistributed in this case
            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.eq(utils.parseEther("50"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("100"),
                utils.parseEther("0.001")
            );

        });

        it("pending tokens function should return the same number of token that user actually receive", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("300"));

            expect(await tgt.balanceOf(alice.address)).to.be.equal(utils.parseEther("700"));
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("300"));

            await rewardToken.mint(tgtStaking.address, utils.parseEther("100")); // We send 100 Tokens to sJoe's address

            await increase(86400 * 7);

            const pendingReward = await tgtStaking.pendingReward(alice.address, rewardToken.address);
            // console.log("pendingReward", pendingReward.toString());
            // console.log("rewardToken.balanceOf(alice.address)", (await rewardToken.balanceOf(alice.address)).toString());
            await tgtStaking.connect(alice).withdraw(0); // Alice shouldn't receive any token of the last reward
            // console.log("rewardToken.balanceOf(alice.address)", (await rewardToken.balanceOf(alice.address)).toString());
            expect(await tgt.balanceOf(alice.address)).to.be.equal(utils.parseEther("700"));
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(pendingReward);
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("300"));
        });

        it("should allow rewards in TGT and USDC", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
            } = await loadFixture(
                deployFixture,
            );

            await tgtStaking.connect(alice).deposit(utils.parseEther("1000"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("1000"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("1000"));
            increase(86400 * 7);
            await rewardToken.mint(tgtStaking.address, utils.parseEther("3"));

            await tgtStaking.connect(alice).withdraw(0);
            // accRewardBalance = rewardBalance * PRECISION / totalStaked
            //                  = 3e18 * 1e24 / 291e18
            //                  = 0.001030927835051546391752e24
            // reward = accRewardBalance * aliceShare / PRECISION
            //        = accRewardBalance * 970e18 / 1e24
            //        = 0.999999999999999999e18
            // aliceRewardDebt = 0.999999999999999999e18
            const aliceRewardBalance = await rewardToken.balanceOf(alice.address);
            expect(aliceRewardBalance).to.be.closeTo(
                utils.parseEther("0.5"),
                utils.parseEther("0.0001")
            );
            // accJoeBalance = 0
            // reward = 0
            expect(await tgt.balanceOf(alice.address)).to.be.equal(0);

            await tgtStaking.addRewardToken(tgt.address);
            await tgt.mint([tgtStaking.address], [utils.parseEther("6")]);

            await tgtStaking.connect(bob).withdraw(0);
            // reward = accRewardBalance * bobShare / PRECISION
            //        = accRewardBalance * 970e18 / 1e24
            //        = 0.999999999999999999e18
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("0.5"),
                utils.parseEther("0.0001")
            );
            // accJoeBalance = tgtBalance * PRECISION / totalStaked
            //                  = 6e18 * 1e24 / 291e18
            //                  = 0.002061855670103092783505e24
            // reward = accJoeBalance * aliceShare / PRECISION
            //        = accJoeBalance * 970e18 / 1e24
            //        = 1.999999999999999999e18
            expect(await tgt.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("1"),
                utils.parseEther("0.0001")
            );

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            // reward = accRewardBalance * aliceShare / PRECISION - aliceRewardDebt
            //        = accRewardBalance * 970e18 / 1e24 - 0.999999999999999999e18
            //        = 0
            // so she has the same balance as previously
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(aliceRewardBalance);
            // reward = accJoeBalance * aliceShare / PRECISION
            //        = accJoeBalance * 970e18 / 1e24
            //        = 1.999999999999999999e18
            expect(await tgt.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("1"),
                utils.parseEther("0.0001")
            );
        });

        it("should linearly increase staking multiplier after 7 days", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                USDC
            } = await loadFixture(deployFixture,);
            let usdc = await USDC.deploy();
            await tgtStaking.addRewardToken(usdc.address);
            await usdc.mint(tgtStaking.address, utils.parseEther("100"));
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("0"));
            await tgtStaking.connect(alice).deposit(1);
            increase(86400 * 7);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("50"));
            increase(86400 * 30);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("54.335"));
            increase(86400 * 60);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("63.005"));
            increase(86400 * 83);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("75"));
            increase(86400 * 90);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("87.16"));
            increase(86400 * 95);
            expect(await tgtStaking.pendingReward(alice.address, usdc.address)).to.be.equal(utils.parseEther("100"));
        });

        it("rewardDebt should be updated as expected, alice deposits before last reward is sent", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                USDC
            } = await loadFixture(deployFixture);

            let usdc = await USDC.deploy();
            await tgtStaking.addRewardToken(usdc.address);
            await tgtStaking.connect(alice).deposit(1);
            await tgtStaking.connect(bob).deposit(1);
            increase(86400 * 365);

            await usdc.mint(tgtStaking.address, utils.parseEther("100"));

            await tgtStaking.connect(alice).withdraw(1);

            let balAlice = await usdc.balanceOf(alice.address);
            let balBob = await usdc.balanceOf(bob.address);
            expect(balAlice).to.be.closeTo(utils.parseEther("50"), utils.parseEther("0.0001"));
            expect(balBob).to.be.equal(0);

            await usdc.mint(tgtStaking.address, utils.parseEther("100"));
            console.log("USDC Staking balance: ", utils.formatEther(await usdc.balanceOf(tgtStaking.address)));
            const pendingRewardBob = await tgtStaking.pendingReward(bob.address, usdc.address)
            console.log("Pending reward for Bob: " + utils.formatEther(pendingRewardBob));

            await tgtStaking.connect(bob).withdraw(0);
            balBob = await usdc.balanceOf(bob.address);
            expect(balBob).to.be.closeTo(pendingRewardBob, utils.parseEther("0.0001"));

            await tgtStaking.connect(alice).deposit(1);
            increase(86400 * 7);

            balBob = await usdc.balanceOf(bob.address);
            expect(await usdc.balanceOf(alice.address)).to.be.equal(balAlice);
            expect(balBob).to.be.closeTo(utils.parseEther("150"), utils.parseEther("0.0001"));

            await usdc.mint(tgtStaking.address, utils.parseEther("100"));

            console.log('step 3 ------------------------------------------------------------------');

            console.log("USDC Alice balance: ", utils.formatEther(await usdc.balanceOf(alice.address)));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            let userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + userInfo[0]);
            console.log("Pending reward for Alice: " + utils.formatEther(await tgtStaking.pendingReward(alice.address, usdc.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, usdc.address)));
            console.log("USDC Bob balance: ", utils.formatEther(await usdc.balanceOf(bob.address)));
            userInfo = await tgtStaking.getUserInfo(bob.address, rewardToken.address);
            console.log("Staking deposit for Bob: " + userInfo[0]);

            console.log("USDC Staking balance: ", utils.formatEther(await usdc.balanceOf(tgtStaking.address)));

            await tgtStaking.connect(bob).withdraw(0);
            await tgtStaking.connect(alice).withdraw(0);

            balAlice = await usdc.balanceOf(alice.address);
            balBob = await usdc.balanceOf(bob.address);

            expect(balAlice).to.be.closeTo(utils.parseEther("75"), utils.parseEther("0.0001"));
            expect(balBob).to.be.closeTo(utils.parseEther("200"), utils.parseEther("0.0001"));

            await tgtStaking.removeRewardToken(usdc.address);
        });

        it("rewardDebt should be updated as expected, alice deposits after last reward is sent", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                USDC
            } = await loadFixture(deployFixture);

            let usdc = await USDC.deploy();
            await tgtStaking.addRewardToken(usdc.address);

            await tgtStaking.connect(alice).deposit(1);
            await tgtStaking.connect(bob).deposit(1);
            increase(86400 * 7);

            await usdc.mint(tgtStaking.address, utils.parseEther("1"));

            await tgtStaking.connect(alice).withdraw(1);

            let balAlice = await usdc.balanceOf(alice.address);
            let balBob = await usdc.balanceOf(bob.address);
            expect(balAlice).to.be.equal(utils.parseEther("0.25"));
            expect(balBob).to.be.equal(0);

            await usdc.mint(tgtStaking.address, utils.parseEther("1"));
            await tgtStaking.connect(bob).withdraw(0);

            balBob = await usdc.balanceOf(bob.address);
            expect(await usdc.balanceOf(alice.address)).to.be.equal(balAlice);
            expect(balBob).to.be.closeTo(utils.parseEther("0.75"), utils.parseEther("0.0001"));

            await usdc.mint(tgtStaking.address, utils.parseEther("1"));

            await tgtStaking.connect(alice).deposit(1);
            await tgtStaking.connect(bob).withdraw(0);
            await tgtStaking.connect(alice).withdraw(0);

            balAlice = await usdc.balanceOf(alice.address);
            balBob = await usdc.balanceOf(bob.address);
            expect(balAlice).to.be.equal(utils.parseEther("0.25"));
            expect(balBob).to.be.equal(utils.parseEther("1.25"));
        });

        it("should allow adding and removing a rewardToken, only by owner", async function () {
            const {
                tgtStaking,
                tgt,
                rewardToken,
                dev,
                alice,
                USDC
            } = await loadFixture(deployFixture);

            let token1 = await USDC.deploy();
            await expect(
                tgtStaking.connect(alice).addRewardToken(token1.address)
            ).to.be.revertedWith("OwnableUnauthorizedAccount");
            expect(
                await tgtStaking.isRewardToken(token1.address)
            ).to.be.equal(false);
            expect(await tgtStaking.rewardTokensLength()).to.be.equal(1);

            await tgtStaking
                .connect(dev)
                .addRewardToken(token1.address);
            await expect(
                tgtStaking.connect(dev).addRewardToken(token1.address)
            ).to.be.revertedWith("TGTStaking: token can't be added");
            expect(
                await tgtStaking.isRewardToken(token1.address)
            ).to.be.equal(true);
            expect(await tgtStaking.rewardTokensLength()).to.be.equal(2);

            await tgtStaking
                .connect(dev)
                .removeRewardToken(token1.address);
            expect(
                await tgtStaking.isRewardToken(token1.address)
            ).to.be.equal(false);
            expect(await tgtStaking.rewardTokensLength()).to.be.equal(1);
        });

        it("should allow emergency withdraw", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
            } = await loadFixture(
                deployFixture,
            );

            await tgtStaking.connect(alice).deposit(utils.parseEther("300"));
            expect(await tgt.balanceOf(alice.address)).to.be.equal(utils.parseEther("700"));
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(utils.parseEther("300"));

            await rewardToken.mint(tgtStaking.address, utils.parseEther("100")); // We send 100 Tokens to sJoe's address

            await tgtStaking.connect(alice).emergencyWithdraw(); // Alice shouldn't receive any token of the last reward
            expect(await tgt.balanceOf(alice.address)).to.be.equal(
                utils.parseEther("1000")
            );
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(0);
            expect(await tgt.balanceOf(tgtStaking.address)).to.be.equal(0);
            const userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            expect(userInfo[0]).to.be.equal(0);
            expect(userInfo[1]).to.be.equal(0);
        });

        it("should properly calculate and distribute rewards for multiple users in different time periods ", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                dev,
                bob,
                carol,
                tgtMaker
            } = await loadFixture(
                deployFixture,
            );

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("100"));

            await increase(86400 * 365);
            await tgtStaking.connect(bob).deposit(utils.parseEther("100")); // Bob enters
            await increase(86400 * 7);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            // alice = 100 1 year = 2x
            // bob= 100 7 days = 1x
            // carol = 100 7 days = 1x
            // share = totalRewardBalance 100 / 4x = 25
            // alice = 2 x share = 50

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("accRewardPerShare: ", utils.formatEther(await tgtStaking.accRewardPerShare(rewardToken.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));
            console.log("--------------------------------------");

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("33.3333"),
                utils.parseEther("0.0001")
            );
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("16.6666"),
                utils.parseEther("0.0001")
            );
            await tgtStaking.connect(carol).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(carol.address)).to.be.closeTo(
                utils.parseEther("33.3333"),
                utils.parseEther("0.0001")
            )

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(carol.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            await increase(86400 * 365);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));


            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));
            console.log("--------------------------------------");

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(carol).withdraw(utils.parseEther("0"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("66.66"),
                utils.parseEther("0.01")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("66.66"),
                utils.parseEther("0.01")
            );
            expect(await rewardToken.balanceOf(carol.address)).to.be.closeTo(
                utils.parseEther("66.66"),
                utils.parseEther("0.01")
            )
            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Reward balance Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance Bob: ", utils.formatEther(await rewardToken.balanceOf(bob.address)));
            console.log("Reward balance Carol: ", utils.formatEther(await rewardToken.balanceOf(carol.address)));

        });

        it.skip("should calculate rewards correctly when the number of depositors is >= 200", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                dev,
                bob,
                carol,
                tgtMaker
            } = await loadFixture(deployFixture);

            for (let i = 0; i < 200; i++) {
                const signer = new ethers.Wallet.createRandom().connect(ethers.provider);
                await dev.sendTransaction({to: signer.address, value: utils.parseEther("0.1")});
                await tgt.connect(dev).mint2(signer.address, utils.parseEther("100"));
                await tgt.connect(signer).approve(tgtStaking.address, utils.parseEther("1000"));
                await tgtStaking.connect(signer).deposit(utils.parseEther("100"));
            }

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("100"));

            await increase(86400 * 365);
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 10);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));
            console.log("--------------------------------------");

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(carol).withdraw(utils.parseEther("0"));

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(carol.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

        }).timeout(1000000);

        it("pending reward should be updated for all stakers when there is a new deposit of reward tokens", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 365);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("accRewardPerShare: ", utils.formatEther(await tgtStaking.accRewardPerShare(rewardToken.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50"));
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.0001")
            );
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.0001")
            );

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            increase(86400 * 365);

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("33.333333333333333333"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("66.666666666666666666"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("83.333"),
                utils.parseEther("0.001")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("116.666"),
                utils.parseEther("0.001")
            );

            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Reward balance Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance Bob: ", utils.formatEther(await rewardToken.balanceOf(bob.address)));

        });

        it("extra rewards should be distributed to community plus stakers", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 7);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("25"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50")); // unclaimed rewards so far = 25
            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.equal(utils.parseEther("25"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.0001")
            );

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Total staked balance: ", utils.formatEther(await tgt.balanceOf(tgtStaking.address)));

            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(
                utils.parseEther("25")
            );

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.equal(utils.parseEther("25"));

            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.001")
            );

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            increase(86400 * 7);

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("16.666666666666666666"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("34.511666666666666666"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50"));
            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.closeTo(utils.parseEther("41.666"), utils.parseEther("0.001"));

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));


            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("41.666"),
                utils.parseEther("0.001")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("59.5116"),
                utils.parseEther("0.001")
            );

            increase(86400 * 365);
            console.log("-------------breakpoint-------------------------");

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Reward balance Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance Bob: ", utils.formatEther(await rewardToken.balanceOf(bob.address)));

            //these funds are to be redistributed to community plus stakers
            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.closeTo(utils.parseEther("41.6666"), utils.parseEther("0.0001"));

            // Extra rewards claim redistribution

            await expect(tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0)).to.be.revertedWith("TGTStaking: not eligible for extra rewards");
            let userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + utils.formatEther(userInfo[0]));

            await tgt.connect(tgtMaker).transfer(alice.address, utils.parseEther("350000"));
            await tgtStaking.connect(alice).deposit(utils.parseEther("350000"));
            increase(86400 * 365);
            userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + utils.formatEther(userInfo[0]));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Reward balance before Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));

            await tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0);
            console.log("Reward balance after extra rewards Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));

        });

        it("claimExtraRewards should not underflow", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 7);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("25"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50")); // unclaimed rewards so far = 25
            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.equal(utils.parseEther("25"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.0001")
            );

            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(
                utils.parseEther("25")
            );

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.equal(utils.parseEther("25"));

            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.001")
            );

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            increase(86400 * 7);

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("16.666666666666666666"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("34.511666666666666666"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50"));
            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.equal(utils.parseEther("41.666666666666666667"));

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("41.666"),
                utils.parseEther("0.001")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("59.5116"),
                utils.parseEther("0.001")
            );

            increase(86400 * 365);

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            //these funds are to be redistributed to community plus stakers
            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.closeTo(utils.parseEther("41.6666"), utils.parseEther("0.0001"));

            // Extra rewards claim redistribution
            await expect(tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0)).to.be.revertedWith("TGTStaking: not eligible for extra rewards");
            expect(await tgtStaking.connect(alice).pendingExtraRewards(alice.address, rewardToken.address)).to.be.equal(0);
            let userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + utils.formatEther(userInfo[0]));

            await tgt.connect(tgtMaker).transfer(alice.address, utils.parseEther("350000"));
            await tgt.connect(tgtMaker).transfer(bob.address, utils.parseEther("350000"));
            await tgtStaking.connect(alice).deposit(utils.parseEther("350000"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("350000"));
            increase(86400 * 365);
            userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + utils.formatEther(userInfo[0]));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Reward balance before Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            expect(await tgtStaking.connect(alice).pendingExtraRewards(alice.address, rewardToken.address)).to.be.closeTo(utils.parseEther("20.83"), utils.parseEther("0.001"));

            await tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0);

            await tgtStaking.connect(bob).withdrawAndClaimExtraRewards(0);
            await tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0);
            await tgtStaking.connect(alice).withdrawAndClaimExtraRewards(0);
            await tgtStaking.connect(bob).withdrawAndClaimExtraRewards(0);
            console.log("Reward balance after extra rewards Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
        });

        //This test is invalid as we don't allow redistribution now
        it.skip("unclaimed rewards should be redistributed to other stakers", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 7);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("accRewardPerShare: ", utils.formatEther(await tgtStaking.accRewardPerShare(rewardToken.address)));

            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");

            await tgtStaking.connect(alice).withdraw(utils.parseEther("100"));
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.0001")
            );
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.0001")
            );

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("50"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("25"),
                utils.parseEther("0.001")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("87.5"),
                utils.parseEther("0.001")
            );

            await increase(86400 * 365);

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Reward balance Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance Bob: ", utils.formatEther(await rewardToken.balanceOf(bob.address)));

            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("175"),
                utils.parseEther("0.001")
            );

            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.closeTo(utils.parseEther("0"), utils.parseEther("0.00001"));
        });

        it("redistribution of rewards after an early withdrawal", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                dev,
                bob,
                carol,
                tgtMaker
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));
            await increase(86400 * 7);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("200"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("50"));
            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.0001")
            );

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.001")
            );

            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("0"));

            increase(86400 * 365);

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("3"));

            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("51"));
            expect(await tgtStaking.pendingReward(bob.address, rewardToken.address)).to.be.equal(utils.parseEther("52"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));

            expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
                utils.parseEther("101"),
                utils.parseEther("0.001")
            );
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("102"),
                utils.parseEther("0.001")
            );

            console.log("Reward balance after all withdrawals: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Reward balance Alice: ", utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance Bob: ", utils.formatEther(await rewardToken.balanceOf(bob.address)));

            expect(await rewardToken.balanceOf(tgtStaking.address)).to.be.closeTo(utils.parseEther("0"), utils.parseEther("0.00001"));
        });

        it("Pending rewards can't exceed the reward pool when remittance is sent after large depositors", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3000"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("1100"));

            await tgtStaking.connect(alice).deposit(utils.parseEther("10"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("10"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("10"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("2858"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("10"));
            await increase(86400 * 10);
            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            await tgtStaking.connect(bob).deposit(utils.parseEther("1100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });

        it("Pending rewards can't exceed the reward pool when remittance is sent before large depositors", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3000"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("1100"));

            await tgtStaking.connect(alice).deposit(utils.parseEther("10"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("10"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("10"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("10"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("2858"));
            await increase(86400 * 10);

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // await tgtStaking.connect(bob).deposit(utils.parseEther("1100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });

        it("Pending rewards can't exceed the reward pool in realistic scenario", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3300"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("2000"));

            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("200"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("300"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("300"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("3000"));
            await increase(86400 * 10);
            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("200"));

            await tgtStaking.connect(bob).deposit(utils.parseEther("2000"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

            await tgtStaking.connect(bob).deposit(utils.parseEther("200"));

            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

            await tgtStaking.connect(alice).deposit(utils.parseEther("300"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));
            increase(86400 * 5);

            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            increase(86400 * 5);
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("200"));

            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });

        it("Pending rewards can't exceed the reward pool when remittance is sent before large depositors on original contract implementation", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe,
                joeStaking
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3000"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("1100"));

            await joeStaking.connect(alice).deposit(utils.parseEther("10"));
            await joeStaking.connect(bob).deposit(utils.parseEther("10"));
            await joeStaking.connect(carol).deposit(utils.parseEther("10"));
            await joeStaking.connect(carol).deposit(utils.parseEther("1"));
            await rewardToken.connect(tgtMaker).transfer(joeStaking.address, utils.parseEther("10"));
            await joeStaking.connect(carol).deposit(utils.parseEther("3000"));
            await increase(86400 * 10);
            await rewardToken.connect(tgtMaker).transfer(joeStaking.address, utils.parseEther("10"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(joeStaking.address)));

            // await joeStaking.connect(bob).deposit(utils.parseEther("1100"));

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(joeStaking.address)));

            console.log("Pending reward for Alice: " + utils.formatUnits(await joeStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            console.log("Pending reward for Bob: " + utils.formatUnits(await joeStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            console.log("Pending reward for Carol: " + utils.formatUnits(await joeStaking.pendingReward(carol.address, rewardToken.address), 18));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await joeStaking.pendingReward(alice.address, rewardToken.address))
                .add(await joeStaking.pendingReward(bob.address, rewardToken.address))
                .add(await joeStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(joeStaking.address));

        });

        it("Pending rewards can't exceed the reward pool when remittance is sent before large depositors with existing stakers with multipliers", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3000"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("1100"));

            await tgtStaking.connect(alice).deposit(utils.parseEther("10"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("10"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            await increase(86400 * 10);

            await tgtStaking.connect(bob).deposit(utils.parseEther("100"));

            await tgtStaking.connect(carol).deposit(utils.parseEther("10"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("2858"));

            await increase(86400 * 10);

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));


            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });


        it("Special case logic exploit can't exceed reward pool balance", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgt.connect(joe).transfer(carol.address, utils.parseEther("3000"));
            await tgt.connect(joe).transfer(bob.address, utils.parseEther("1100"));

            await tgtStaking.connect(alice).deposit(utils.parseEther("10"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("10"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            await increase(86400 * 10);

            await tgtStaking.connect(bob).deposit(utils.parseEther("1000"));

            await tgtStaking.connect(carol).deposit(utils.parseEther("10"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("1000"));

            await increase(86400 * 10);

            console.log("Reward pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));

            console.log("--------------------------------------");
            let userInfo = await tgtStaking.getUserInfo(alice.address, rewardToken.address);
            console.log("Staking deposit for Alice: " + utils.formatEther(userInfo[0]));
            // console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("Reward debt for Alice: " + utils.formatEther(userInfo[1]));

            console.log("--------------------------------------");
            userInfo = await tgtStaking.getUserInfo(bob.address, rewardToken.address);
            console.log("Staking deposit for Bob: " + utils.formatEther(userInfo[0]));
            // console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("Reward debt for Bob: " + utils.formatEther(userInfo[1]));

            console.log("--------------------------------------");
            userInfo = await tgtStaking.getUserInfo(carol.address, rewardToken.address);
            console.log("Staking deposit for Carol: " + utils.formatEther(userInfo[0]));
            // console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));
            console.log("Reward debt for Carol: " + utils.formatEther(userInfo[1]));

            // Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });

        it("original protocol reward distribution test", async function () {

            const {
                joeStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
            } = await loadFixture(deployFixture);

            await joeStaking.connect(alice).deposit(utils.parseEther("100"));
            await joeStaking.connect(carol).deposit(utils.parseEther("100"));

            await rewardToken.connect(tgtMaker).transfer(joeStaking.address, utils.parseEther("100"));

            /// now Bob enters, and he will only receive the rewards deposited after he entered
            await joeStaking.connect(bob).deposit(utils.parseEther("500"));

            console.log("Reward pool balance: " + (await rewardToken.balanceOf(joeStaking.address)).toString());
            console.log("Pending reward for Alice: " + utils.formatEther((await joeStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            console.log("Pending reward for Bob: " + utils.formatEther(await joeStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Pending reward for Carol: " + utils.formatEther(await joeStaking.pendingReward(carol.address, rewardToken.address)));

            await joeStaking.connect(carol).withdraw(utils.parseEther("100"));

            expect(await rewardToken.balanceOf(carol.address)).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.0001")
            );

            console.log("Reward pool balance: " + (await rewardToken.balanceOf(joeStaking.address)).toString());

            await joeStaking.connect(alice).deposit(utils.parseEther("100")); // Alice enters again to try to get more rewards
            await joeStaking.connect(alice).withdraw(utils.parseEther("200"));
            // She gets the same reward as Carol
            const lastAliceBalance = await rewardToken.balanceOf(alice.address);

            expect(lastAliceBalance).to.be.closeTo(
                utils.parseEther("50"),
                utils.parseEther("0.001")
            );

            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(joeStaking.address)).toString());
            console.log("Pending reward for Bob: " + utils.formatEther(await joeStaking.pendingReward(bob.address, rewardToken.address)));

            // Reward pool should have enough tokens to pay Bob
            expect(await joeStaking.pendingReward(bob.address, rewardToken.address)).to.be.lte(await rewardToken.balanceOf(joeStaking.address));

            console.log("Staking deposit for Alice: " + (await joeStaking.getUserInfo(alice.address, rewardToken.address))[0]);
            console.log("Staking deposit for Carol: " + (await joeStaking.getUserInfo(carol.address, rewardToken.address))[0]);
            console.log("Staking deposit for Bob: " + (await joeStaking.getUserInfo(bob.address, rewardToken.address))[0]);

            await rewardToken.connect(tgtMaker).transfer(joeStaking.address, utils.parseEther("100"));

            console.log("Pending reward for Bob: " + utils.formatEther(await joeStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("Reward pool balance: " + utils.formatEther(await rewardToken.balanceOf(joeStaking.address)).toString());

            await joeStaking.connect(bob).withdraw("0");

            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("100"),
                utils.parseEther("0.001")
            );

            // Alice shouldn't receive any token of the last reward
            await joeStaking.connect(alice).withdraw("0");
            // reward = accRewardBalance * aliceShare / PRECISION - aliceRewardDebt
            //        = accRewardBalance * 0 / PRECISION - 0
            //        = 0      (she withdrew everything, so her share is 0)
            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(lastAliceBalance);

            console.log("--------------------------------------");
            console.log("Reward pool balance at the end: " + (await rewardToken.balanceOf(joeStaking.address)).toString());
            console.log("--------------------------------------");
            console.log("Staking deposit for Alice: " + (await joeStaking.getUserInfo(alice.address, rewardToken.address))[0]);
            console.log("Reward balance for Alice at the end: " + utils.formatEther(await rewardToken.balanceOf(alice.address)).toString());
            console.log("Pending reward for Alice: " + utils.formatEther(await joeStaking.pendingReward(alice.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Staking deposit for Bob: " + (await joeStaking.getUserInfo(bob.address, rewardToken.address))[0]);
            console.log("Reward balance for Bob at the end: " + utils.formatEther(await rewardToken.balanceOf(bob.address)).toString());
            console.log("Pending reward for Bob: " + utils.formatEther(await joeStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("--------------------------------------");
            console.log("Staking deposit for Carol: " + (await joeStaking.getUserInfo(carol.address, rewardToken.address))[0]);
            console.log("Reward balance for Carol at the end: " + utils.formatEther(await rewardToken.balanceOf(carol.address)).toString());
            console.log("Pending reward for Carol: " + utils.formatEther(await joeStaking.pendingReward(carol.address, rewardToken.address)));
        });

        it("Staking rewards redistribution to community plus users", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);

            await tgtStaking.connect(alice).deposit(utils.parseEther("20"));
            increase(86400 * 365);
            await tgtStaking.connect(bob).deposit(utils.parseEther("30"));
            increase(86400 * 7);
            await tgtStaking.connect(carol).deposit(utils.parseEther("50"));

            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1000"));

            console.log("-- -- - Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));

            console.log("Reward pool balance: " + (await rewardToken.balanceOf(tgtStaking.address)).toString());
            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("--------------------------------------");
            expect(await tgtStaking.pendingReward(alice.address, rewardToken.address)).to.be.equal(utils.parseEther("200"));

            await tgtStaking.connect(alice).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("0"));
            await tgtStaking.connect(carol).withdraw(utils.parseEther("0"));

            console.log("Pending reward for Alice: " + utils.formatEther((await tgtStaking.pendingReward(alice.address, rewardToken.address))));
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Reward balance for Alice: " + utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("--------------------------------------");
            console.log("Pending reward for Bob: " + utils.formatEther(await tgtStaking.pendingReward(bob.address, rewardToken.address)));
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Reward balance for Bob: " + utils.formatEther(await rewardToken.balanceOf(bob.address)));
            console.log("--------------------------------------");
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));
            console.log("Reward balance for Carol: " + utils.formatEther(await rewardToken.balanceOf(carol.address)));

            console.log("Reward pool balance: " + (await rewardToken.balanceOf(tgtStaking.address)).toString());

            expect(await rewardToken.balanceOf(alice.address)).to.be.equal(utils.parseEther("200"));
            expect(await rewardToken.balanceOf(bob.address)).to.be.equal(utils.parseEther("150"));
            expect(await rewardToken.balanceOf(carol.address)).to.be.equal(utils.parseEther("0"));

            increase(86400 * 365);
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending reward for Carol: " + utils.formatEther(await tgtStaking.pendingReward(carol.address, rewardToken.address)));
            expect(await tgtStaking.pendingReward(carol.address, rewardToken.address)).to.be.equal(utils.parseEther("500"));
            await tgtStaking.connect(carol).withdraw(utils.parseEther("0"));
            expect(await rewardToken.balanceOf(carol.address)).to.be.equal(utils.parseEther("500"));

        });

        it("Production test case simulation, ensures no funds end up unclaimable", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);


            await tgtStaking.connect(alice).deposit(utils.parseEther("10"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("50"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("20"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("10"));

            await increase(86400 * 10);

            await tgtStaking.connect(bob).withdraw(utils.parseEther("50"));

            console.log("Reward balance for Bob: " + utils.formatEther(await rewardToken.balanceOf(bob.address)));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("3.150937"),
                utils.parseEther("0.01")
            );

            await tgtStaking.connect(bob).deposit(utils.parseEther("50"));
            expect(await tgtStaking.getStakingMultiplier(bob.address)).to.be.equal(utils.parseEther("0.0"));

            await tgt.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));
            await tgtStaking.addRewardToken(tgt.address);

            await tgtStaking.connect(bob).withdraw(utils.parseEther("50"));
            await tgt.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));

            await tgtStaking.connect(bob).deposit(utils.parseEther("50"));
            await tgt.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("100"));
            await tgtStaking.connect(bob).withdraw(utils.parseEther("50"));

            console.log("Forgone USDC reward pool balance: " + utils.formatEther(await tgtStaking.forgoneRewardsPool(rewardToken.address)));
            console.log("Forgone TGT reward pool balance: " + utils.formatEther(await tgtStaking.forgoneRewardsPool(tgt.address)));

            console.log("Reward USDC pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Total TGT pool balance: ", utils.formatEther(await tgt.balanceOf(tgtStaking.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending USDC reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("Pending TGT reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, tgt.address), 18));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending USDC reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("Pending TGT reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, tgt.address), 18));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending USDC reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));
            console.log("Pending TGT reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, tgt.address), 18));

            console.log("- - - END -- STATE- -- - - -- -");

            //Forgone rewards from Bob should equal 125 TGT
            expect(await tgtStaking.forgoneRewardsPool(tgt.address)).to.be.equal(utils.parseEther("125"));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });


        it("Ensure forgoneRewardsPool never goes over the available amount of tokens", async function () {

            const {
                tgtStaking,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
                joe
            } = await loadFixture(deployFixture);


            await tgtStaking.connect(alice).deposit(utils.parseEther("100"));
            await tgtStaking.connect(bob).deposit(utils.parseEther("200"));
            await tgtStaking.connect(carol).deposit(utils.parseEther("100"));
            await rewardToken.connect(tgtMaker).transfer(tgtStaking.address, utils.parseEther("1000"));

            await increase(86400 * 30);

            await tgtStaking.connect(carol).withdraw(utils.parseEther("100"));

            console.log("Reward balance for Carol: " + utils.formatEther(await rewardToken.balanceOf(carol.address)));
            expect(await rewardToken.balanceOf(carol.address)).to.be.closeTo(
                utils.parseEther("133.30"),
                utils.parseEther("0.01")
            );

            await increase(86400 * 365);
            expect(await tgtStaking.getStakingMultiplier(bob.address)).to.be.equal(utils.parseEther("1"));

            await tgtStaking.connect(bob).withdraw(utils.parseEther("200"));
            expect(await tgtStaking.getStakingMultiplier(bob.address)).to.be.equal(utils.parseEther("0.0"));

            console.log("Reward balance for Bob: " + utils.formatEther(await rewardToken.balanceOf(bob.address)));
            expect(await rewardToken.balanceOf(bob.address)).to.be.closeTo(
                utils.parseEther("500"),
                utils.parseEther("0.01")
            );

            console.log("Forgone USDC reward pool balance: " + utils.formatEther(await tgtStaking.forgoneRewardsPool(rewardToken.address)));

            console.log("Reward USDC pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStaking.address)));
            console.log("Total TGT pool balance: ", utils.formatEther(await tgt.balanceOf(tgtStaking.address)));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Alice: " + utils.formatEther(await tgtStaking.getStakingMultiplier(alice.address)));
            console.log("Pending USDC reward for Alice: " + utils.formatUnits(await tgtStaking.pendingReward(alice.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Bob: " + utils.formatEther(await tgtStaking.getStakingMultiplier(bob.address)));
            console.log("Pending USDC reward for Bob: " + utils.formatUnits(await tgtStaking.pendingReward(bob.address, rewardToken.address), 18));
            console.log("--------------------------------------");
            console.log("Staking multiplier for Carol: " + utils.formatEther(await tgtStaking.getStakingMultiplier(carol.address)));
            console.log("Pending USDC reward for Carol: " + utils.formatUnits(await tgtStaking.pendingReward(carol.address, rewardToken.address), 18));

            console.log("- - - END -- STATE- -- - - -- -");

            //Forgone rewards for Alice should equal 125 USDC
            expect(await tgtStaking.forgoneRewardsPool(rewardToken.address)).to.be.closeTo(utils.parseEther("116.693"), utils.parseEther("0.001"));

            //Total pending reward amount can't exceed the reward pool balance
            expect((await tgtStaking.pendingReward(alice.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(bob.address, rewardToken.address))
                .add(await tgtStaking.pendingReward(carol.address, rewardToken.address))
            ).to.be.lte(await rewardToken.balanceOf(tgtStaking.address));

        });

        it("Auto staking", async function () {

            const {
                tgtStakingBasic,
                tgt,
                rewardToken,
                alice,
                bob,
                carol,
                tgtMaker,
            } = await loadFixture(deployFixture);

            await tgtStakingBasic.connect(alice).deposit(utils.parseEther("100"));
            await tgtStakingBasic.connect(bob).deposit(utils.parseEther("200"));
            await rewardToken.connect(tgtMaker).transfer(tgtStakingBasic.address, utils.parseEther("100"));
            await increase(86400 * 365);

            console.log("Reward USDC pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStakingBasic.address)));
            console.log("Before Total TGT pool balance: ", utils.formatEther(await tgt.balanceOf(tgtStakingBasic.address)));
            console.log("--------------------------------------");
            console.log("Pending USDC reward for Alice: " + utils.formatUnits(await tgtStakingBasic.pendingReward(alice.address, rewardToken.address), 18));
            console.log("Pending USDC reward for Bob: " + utils.formatUnits(await tgtStakingBasic.pendingReward(bob.address, rewardToken.address), 18));

            console.log("Reward balance of Alice: " + utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance of Bob: " + utils.formatEther(await rewardToken.balanceOf(bob.address)));
            console.log("--------------------------------------");

            // await rewardToken.connect(tgtMaker).transfer(tgtStakingBasic.address, utils.parseEther("100"));
            await tgtStakingBasic.connect(bob).restakeRewards();

            console.log("Reward USDC pool balance: ", utils.formatEther(await rewardToken.balanceOf(tgtStakingBasic.address)));
            console.log("After Total TGT pool balance: ", utils.formatEther(await tgt.balanceOf(tgtStakingBasic.address)));
            console.log("--------------------------------------");
            console.log("Pending USDC reward for Alice: " + utils.formatUnits(await tgtStakingBasic.pendingReward(alice.address, rewardToken.address), 18));
            console.log("Pending USDC reward for Bob: " + utils.formatUnits(await tgtStakingBasic.pendingReward(bob.address, rewardToken.address), 18));

            console.log("Reward balance of Alice: " + utils.formatEther(await rewardToken.balanceOf(alice.address)));
            console.log("Reward balance of Bob: " + utils.formatEther(await rewardToken.balanceOf(bob.address)));
            console.log("--------------------------------------");
        });

    });

    // after(async function () {
    //     await network.provider.request({
    //         method: "hardhat_reset",
    //         params: [],
    //     });
    // });
})
;

const increase = (seconds) => {
    ethers.provider.send("evm_increaseTime", [seconds]);
    ethers.provider.send("evm_mine", []);
};