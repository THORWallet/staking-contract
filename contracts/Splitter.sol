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
    uint256 public maxGas = 152298;
    uint256 public gasPriceBid = 300000000;
    uint256 public maxSubmissionCost = maxGas * gasPriceBid;

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

    function releaseUsdcFunds() public payable {
        IERC20(usdc).approve(arbitrumGateway.getGateway(usdc), IERC20(usdc).balanceOf(address(this)));
        uint256 nativeTokenTotalFee = maxGas * gasPriceBid;
        bytes memory userEncodedData = abi.encode(maxSubmissionCost, "", nativeTokenTotalFee);
        arbitrumGateway.outboundTransfer{value: msg.value}(usdc, treasury, IERC20(usdc).balanceOf(address(this)), maxGas, gasPriceBid, userEncodedData);
    }

    function customBridgeUsdcToArbitrum(uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, uint256 _maxSubmissionCost) external payable {
        IERC20(usdc).approve(arbitrumGateway.getGateway(usdc), _amount);
        uint256 nativeTokenTotalFee = _maxGas * _gasPriceBid;
        bytes memory userEncodedData = abi.encode(_maxSubmissionCost, "", nativeTokenTotalFee);
        arbitrumGateway.outboundTransfer{value: msg.value}(usdc, treasury, _amount, _maxGas, _gasPriceBid, userEncodedData);
    }

    function releaseTgtFunds() public {
        release(IERC20(tgt), treasury);
        release(IERC20(tgt), affiliateCollector);
    }

}
