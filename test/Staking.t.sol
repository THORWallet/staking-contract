// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {TGTStakingBasic} from "../contracts/TGTStakingBasic.sol";
import {USDC} from "../contracts/mocks/USDC.sol";
import {MockTGT} from "../contracts/mocks/MockTGT.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {IERC20Upgradeable} from "../contracts/libraries/IERC20Upgradeable.sol";
import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

contract StakingTest is Test {

    TGTStakingBasic public tgtStaking;
    USDC public usdc;
    MockTGT public tgt;
    address stakingProxy;
    uint pk = vm.envUint("ARBITRUM_PRIVATE_KEY");
    address signer = vm.addr(pk);
    address secondSigner = vm.addr(pk + 1);
    IQuoter public quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
    uint24 public constant poolFee = 500;
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    bytes path;

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

        path = abi.encodePacked(address(usdc), poolFee, WETH, poolFee, address(tgt));

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

        console.log("Sending 1 USDC tokens for rewards");
        usdc.transfer(address(tgtStaking), 1e6);

        (uint256 userBalanceBefore,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance before restaking: %s", userBalanceBefore);

        console.log("USDC balance of user before restaking: %s", usdc.balanceOf(signer));

        uint256 usdcBalanceBefore = usdc.balanceOf(signer);
        uint256[] memory quotes = new uint256[](1);
        quotes[0] = quoter.quoteExactInput(path, tgtStaking.pendingReward(signer, IERC20Upgradeable(address(usdc))));
        tgtStaking.restakeRewards(quotes);

        (uint256 userBalanceAfter,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance after restaking: %s", userBalanceAfter);

        console.log("USDC balance of user after restaking: %s", usdc.balanceOf(signer));

        //User balance should increase after restaking
        assert(userBalanceAfter > userBalanceBefore);
        assert(usdc.balanceOf(signer) == usdcBalanceBefore);
        assert(tgtStaking.pendingReward(signer, IERC20Upgradeable(address(usdc))) == 0);
        vm.stopPrank();
    }

    function test_AutoRestakingMultipleUsers() public {
        vm.startPrank(signer);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);
        vm.stopPrank();

        console.log("Second signer used: %s", address(secondSigner));
        //Second signer needs to be funded with 1 TGT

        vm.startPrank(secondSigner);
        tgt.approve(address(tgtStaking), 1e18);
        tgtStaking.deposit(1e18);
        vm.stopPrank();

        vm.startPrank(signer);

        console.log("Sending 10 USDC tokens for rewards");
        usdc.transfer(address(tgtStaking), 10e6);

        (uint256 userBalanceBefore,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance before restaking: %s", userBalanceBefore);

        console.log("USDC balance of user before restaking: %s", usdc.balanceOf(signer));

        uint256 usdcBalanceBefore = usdc.balanceOf(signer);
        uint256[] memory quotes = new uint256[](1);
        quotes[0] = quoter.quoteExactInput(path, tgtStaking.pendingReward(signer, IERC20Upgradeable(address(usdc))));
        tgtStaking.restakeRewards(quotes);

        (uint256 userBalanceAfter,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance after restaking: %s", userBalanceAfter);

        console.log("USDC balance of user after restaking: %s", usdc.balanceOf(signer));

        //User balance should increase after restaking
        assert(userBalanceAfter > userBalanceBefore);
        assert(usdc.balanceOf(signer) == usdcBalanceBefore);
        assert(tgtStaking.pendingReward(signer, IERC20Upgradeable(address(usdc))) == 0);

        assert(tgtStaking.pendingReward(secondSigner, IERC20Upgradeable(address(usdc))) > 0);
        (uint256 secondUserBalanceAfter,) = tgtStaking.getUserInfo(secondSigner, IERC20Upgradeable(address(usdc)));
        assert(secondUserBalanceAfter == 1e18);

        vm.stopPrank();
    }

}
