// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITokenMessenger.sol";
import "./libraries/PaymentSplitter.sol";
//import "hardhat/console.sol";

contract Splitter is PaymentSplitter, Ownable {

    address public tgt;
    address public usdc;

    address public affiliateCollector;
    address public treasury;
    address public staking;

    ITokenMessenger public circleTokenMessenger;

    constructor(address _tgt, address _usdc, address[] memory _payees, uint256[] memory shares_, address _circleTokenMessengerAddress, address _staking) PaymentSplitter(_payees, shares_) Ownable(_msgSender()){
        tgt = _tgt;
        usdc = _usdc;
        affiliateCollector = _payees[0];
        treasury = _payees[1];
        circleTokenMessenger = ITokenMessenger(_circleTokenMessengerAddress);
        staking = _staking;
    }

    function releaseAllFunds() public {
        releaseTgtFunds();
        releaseUsdcFunds();
    }

    function releaseUsdcFunds() public {
        IERC20(usdc).approve(address(circleTokenMessenger), IERC20(usdc).balanceOf(address(this)));
        uint256 totalAmount = IERC20(usdc).balanceOf(address(this));
        uint32 destinationDomainArbitrum = 3;

        uint256 amountForStaking = (totalAmount * _shares[staking]) / _totalShares;
        uint256 amountForTreasury = (totalAmount * _shares[treasury]) / _totalShares;

        circleTokenMessenger.depositForBurn(amountForStaking, destinationDomainArbitrum, bytes32(uint256(uint160(staking))), usdc);
        circleTokenMessenger.depositForBurn(amountForTreasury, destinationDomainArbitrum, bytes32(uint256(uint160(treasury))), usdc);

        emit PaymentReleased(staking, amountForStaking);
        emit PaymentReleased(treasury, amountForTreasury);
    }

    function releaseTgtFunds() public {
        IERC20(tgt).approve(address(circleTokenMessenger), IERC20(tgt).balanceOf(address(this)));
        uint256 totalAmount = IERC20(tgt).balanceOf(address(this));
        uint32 destinationDomainArbitrum = 3;

        uint256 amountForStaking = (totalAmount * _shares[staking]) / _totalShares;
        uint256 amountForTreasury = (totalAmount * _shares[treasury]) / _totalShares;

        circleTokenMessenger.depositForBurn(amountForStaking, destinationDomainArbitrum, bytes32(uint256(uint160(staking))), tgt);
        circleTokenMessenger.depositForBurn(amountForTreasury, destinationDomainArbitrum, bytes32(uint256(uint160(treasury))), tgt);

        emit PaymentReleased(staking, amountForStaking);
        emit PaymentReleased(treasury, amountForTreasury);
    }

    function setStaking(address _staking) public onlyOwner {
        staking = _staking;
    }

    function setTreasury(address _treasury) public onlyOwner {
        treasury = _treasury;
    }

}
