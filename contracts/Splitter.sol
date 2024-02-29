// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITokenGateway.sol";
import "hardhat/console.sol";

contract Splitter is PaymentSplitter, Ownable {

    address public tgt;
    address public usdc;

    address public affiliateCollector;
    address public treasury;

    ITokenGateway public arbitrumGateway;

    constructor(address _tgt, address _usdc, address[] memory _payees, uint256[] memory shares_, address _arbitrumGateway) PaymentSplitter(_payees, shares_) {
        tgt = _tgt;
        usdc = _usdc;
        affiliateCollector = _payees[0];
        treasury = _payees[1];
        arbitrumGateway = ITokenGateway(_arbitrumGateway);
    }

    function releaseAllFunds() public {
        releaseTgtFunds();
        releaseUsdcFunds();
    }

    function releaseUsdcFunds() public {
//        release(IERC20(usdc), treasury);
//        release(IERC20(usdc), affiliateCollector);
        console.log("USDC balance: ", IERC20(usdc).balanceOf(address(this)));
        IERC20(usdc).approve(address(arbitrumGateway), IERC20(usdc).balanceOf(address(this)));
//        circleTokenMessenger.depositForBurn(IERC20(usdc).balanceOf(address(this)), 3, bytes32(bytes20(treasury)), usdc);

        uint256 maxGas = 100000;
        uint256 gasPriceBid = 3;
        uint256 maxSubmissionCost = 0;

        uint256 nativeTokenTotalFee = maxGas * gasPriceBid;
        bytes memory userEncodedData = abi.encode(maxSubmissionCost, "", nativeTokenTotalFee);

        arbitrumGateway.outboundTransfer(usdc, treasury, IERC20(usdc).balanceOf(address(this)), maxGas, gasPriceBid, userEncodedData);

    }

    function releaseTgtFunds() public {
        release(IERC20(tgt), treasury);
        release(IERC20(tgt), affiliateCollector);
    }

}
