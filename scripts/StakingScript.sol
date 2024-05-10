// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "../lib/forge-std/src/Script.sol";
import {TGTStakingBasic} from "../contracts/TGTStakingBasic.sol";
import {USDC} from "../contracts/mocks/USDC.sol";
import {MockTGT} from "../contracts/mocks/MockTGT.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {IERC20Upgradeable} from "../contracts/libraries/IERC20Upgradeable.sol";


contract StakingScript is Script {
    TGTStakingBasic public tgtStaking;
    USDC public usdc;
    MockTGT public tgt;
    address stakingProxy;


    function run() public {

        uint privateKey = vm.envUint("ARBITRUM_PRIVATE_KEY");
        address signer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        usdc = USDC(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        tgt = MockTGT(0x429fEd88f10285E61b12BDF00848315fbDfCC341);

        stakingProxy = Upgrades.deployTransparentProxy(
            "TGTStakingBasic.sol",
            msg.sender,
            abi.encodeCall(TGTStakingBasic.initialize, (IERC20Upgradeable(address(tgt)), IERC20Upgradeable(address(usdc)), msg.sender, 0))
        );

        tgtStaking = TGTStakingBasic(stakingProxy);

        tgt.approve(address(tgtStaking), 1e17);
        tgtStaking.deposit(1e17);

        (uint256 userBalance,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance before restaking: %s", userBalance);

        usdc.transfer(address(tgtStaking), 1e4);

        tgtStaking.restakeRewards();

        (userBalance,) = tgtStaking.getUserInfo(signer, IERC20Upgradeable(address(usdc)));
        console.log("Deposited TGT balance after restaking: %s", userBalance);

        console.log("TGT staking address %s", address(tgtStaking));

        vm.stopBroadcast();
    }
}