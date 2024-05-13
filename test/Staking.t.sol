// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {TGTStakingBasic} from "../contracts/TGTStakingBasic.sol";
import {USDC} from "../contracts/mocks/USDC.sol";
import {MockTGT} from "../contracts/mocks/MockTGT.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {IERC20Upgradeable} from "../contracts/libraries/IERC20Upgradeable.sol";

contract StakingTest is Test {

    TGTStakingBasic public tgtStaking;
    USDC public usdc;
    MockTGT public tgt;
    address stakingProxy;
    uint pk = vm.envUint("ARBITRUM_PRIVATE_KEY");
    address signer = vm.addr(pk);

    function setUp() public {

        usdc = USDC(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        tgt = MockTGT(0x429fEd88f10285E61b12BDF00848315fbDfCC341);
        //Fund these accounts on Tenderly virtual testnet before running tests

        stakingProxy = Upgrades.deployTransparentProxy(
            "TGTStakingBasic.sol",
            msg.sender,
            abi.encodeCall(TGTStakingBasic.initialize, (IERC20Upgradeable(address(tgt)), IERC20Upgradeable(address(usdc)), msg.sender, 0))
        );

        tgtStaking = TGTStakingBasic(stakingProxy);
    }

    function test_Deposit() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);
        vm.stopPrank();
    }


    function test_WithdrawNoRewards() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);
        tgtStaking.withdraw(1e6);
        vm.stopPrank();
    }

    function test_WithdrawWithRewards() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);
        usdc.transfer(address(tgtStaking), 1e6);
        tgtStaking.withdraw(1e6);
        vm.stopPrank();
    }

    function test_DepositConsecutive() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e17);

        console.log("Test signer used: %s", address(signer));
        console.log("Msg sender: %s", address(msg.sender));

        console.log("USDC balance current: %s", usdc.balanceOf(msg.sender));
        console.log("USDC balance current: %s", usdc.balanceOf(signer));
        usdc.transfer(address(tgtStaking), 1e6);

        tgtStaking.deposit(1e17);
        tgtStaking.deposit(1e17);
        vm.stopPrank();
    }

    function test_AutoRestaking() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);

        (uint256 userBalanceBefore,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance before restaking: %s", userBalanceBefore);

        console.log("Minting USDC tokens");
        usdc.transfer(address(tgtStaking), 1e6);
        tgtStaking.restakeRewards();

        (uint256 userBalanceAfter,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance after restaking: %s", userBalanceAfter);

        //User balance should increase after restaking
        assert(userBalanceAfter > userBalanceBefore);
        vm.stopPrank();
    }

}
