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
    USDC public rewardToken;
    MockTGT public tgt;
    address stakingProxy;

    function setUp() public {

        rewardToken = new USDC();
        tgt = new MockTGT();

        stakingProxy = Upgrades.deployTransparentProxy(
            "TGTStakingBasic.sol",
            msg.sender,
            abi.encodeCall(TGTStakingBasic.initialize, (IERC20Upgradeable(address(tgt), IERC20Upgradeable(address(rewardToken))), msg.sender, 0))
        );

        tgtStaking = TGTStakingBasic(stakingProxy);

        rewardToken.mint(msg.sender, 1000e6);
        address [] memory addresses = new address[](2);
        uint96 [] memory amounts = new uint96[](2);
        addresses[0] = msg.sender;
        addresses[1] = address(this);
        amounts[0] = 500e6;
        amounts[1] = 500e6;

        tgt.mint(addresses, amounts);
        tgt.mintFinish();
    }

    function test_Deposit() public {
        tgt.approve(address(tgtStaking), 1e6);
        tgtStaking.deposit(1e6);
    }


}
