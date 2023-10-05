// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Splitter is PaymentSplitter, Ownable {

    address public tgt;
    address public usdc;

    address public stakingContract;
    address public treasury;

    constructor(address _tgt, address _usdc, address[] memory _payees, uint256[] memory shares_) PaymentSplitter(_payees, shares_) {
        tgt = _tgt;
        usdc = _usdc;
        stakingContract = _payees[0];
        treasury = _payees[1];
    }

    //TODO maybe make this onlyOwner or Treasury
    function releaseFunds() public onlyOwner {
        release(IERC20(tgt), treasury);
        release(IERC20(usdc), treasury);

        release(IERC20(tgt), stakingContract);
        release(IERC20(usdc), stakingContract);
    }

}