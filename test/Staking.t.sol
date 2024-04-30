// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {TGTStakingBasic} from "../contracts/TGTStakingBasic.sol";
import {USDC} from "../contracts/mocks/USDC.sol";
import {MockTGT} from "../contracts/mocks/MockTGT.sol";

contract StakingTest is Test {
    TGTStakingBasic public tgtStaking;
    USDC public rewardToken;
    MockTGT public tgt;

    function setUp() public {

        rewardToken = new USDC();
        tgt = new MockTGT();

        tgtStaking = new TGTStakingBasic(
            rewardToken,
            tgt
        );

    }

//    function test_Increment() public {
//        counter.increment();
//        assertEq(counter.number(), 1);
//    }
//
//    function testFuzz_SetNumber(uint256 x) public {
//        counter.setNumber(x);
//        assertEq(counter.number(), x);
//    }
}
