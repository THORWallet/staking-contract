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
    address minter = vm.addr(pk);

    function setUp() public {

        usdc = USDC(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        tgt = new MockTGT();

        stakingProxy = Upgrades.deployTransparentProxy(
            "TGTStakingBasic.sol",
            msg.sender,
            abi.encodeCall(TGTStakingBasic.initialize, (IERC20Upgradeable(address(tgt)), IERC20Upgradeable(address(usdc)), msg.sender, 0))
        );

        tgtStaking = TGTStakingBasic(stakingProxy);

        vm.startPrank(minter);
//        usdc.mint(msg.sender, 1000e6);
        vm.stopPrank();

        address [] memory addresses = new address[](2);
        uint96 [] memory amounts = new uint96[](2);
        addresses[0] = msg.sender;
        addresses[1] = address(this);
        amounts[0] = 500e6;
        amounts[1] = 500e6;

        tgt.mint(addresses, amounts);
        tgt.mintFinish();
    }

//    function test_Deposit() public {
//        tgt.approve(address(tgtStaking), 1e6);
//        tgtStaking.deposit(1e6);
//    }

    function test_AutoRestaking() public {
        tgt.approve(address(tgtStaking), 1e6);
        tgtStaking.deposit(1e6);

        (uint256 userBalance,) = tgtStaking.getUserInfo(address(this), IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance before restaking: %s", userBalance);

        vm.startPrank(minter);
        console.log("Minting USDC tokens");
        console.log("! msg.sender: %s", msg.sender);
        usdc.mint(address(tgtStaking), 100e6);
        tgtStaking.restakeRewards();
        vm.stopPrank();

        (userBalance,) = tgtStaking.getUserInfo(address(this), IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance after restaking: %s", userBalance);
    }

}
