// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
pragma abicoder v2;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {ISwapRouter} from  '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import {TransferHelper} from '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import {SafeMathUpgradeable} from "./libraries/SafeMathUpgradeable.sol";
import {SafeERC20Upgradeable} from "./libraries/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "./libraries/IERC20Upgradeable.sol";

//import "hardhat/console.sol";
//import "forge-std/console.sol";

/**
 * @title TGT Staking
 * @author Thorwallet Team
 * @notice TGTStakingBasic is a contract that allows TGT deposits and receives stablecoins sent by MoneyMaker's daily
 * harvests. Users deposit TGT and receive a share of what has been sent by MoneyMaker based on their participation of
 * the total deposited TGT. It is similar to a MasterChef, but we allow for claiming of different reward tokens
 * (in case at some point we wish to change the stablecoin rewarded).
 * Every time `_updateReward(token)` is called, We distribute the balance of that tokens as rewards to users that are
 * currently staking inside this contract, and they can claim it using `withdraw(0)`
 */
contract TGTStakingBasic is Initializable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Info of each user
    struct UserInfo {
        uint256 amount;
        mapping(IERC20Upgradeable => uint256) rewardDebt;
        /**
         * @notice We do some fancy math here. Basically, any point in time, the amount of TGTs
         * entitled to a user but is pending to be distributed is:
         *
         *   pending reward = (user.amount * accRewardPerShare) - user.rewardDebt[token]
         *
         * Whenever a user deposits or withdraws TGT. Here's what happens:
         *   1. accRewardPerShare (and `lastRewardBalance`) gets updated
         *   2. User receives the pending reward sent to his/her address
         *   3. User's `amount` gets updated
         *   4. User's `rewardDebt[token]` gets updated
         */
    }

    // @dev gap to keep the storage ordering, replace `IERC20Upgradeable public tgt;`
    uint256[1] private __gap0;

    /// @notice The address of the TGT token
    IERC20Upgradeable public tgt;

    /// @dev Internal balance of TGT, this gets updated on user deposits / withdrawals
    /// this allows to reward users with TGT
    uint256 public internalTgtBalance;

    /// @notice Array of tokens that users can claim
    IERC20Upgradeable[] public rewardTokens;

    /// @notice Mapping to check if a token is a reward token
    mapping(IERC20Upgradeable => bool) public isRewardToken;

    /// @notice Last reward balance of `token`
    mapping(IERC20Upgradeable => uint256) public lastRewardBalance;

    /// @notice The address where deposit fees will be sent
    address public feeCollector;

    /// @notice Reentrancy guard
    bool public reentrant;

    /// @notice The deposit fee, scaled to `DEPOSIT_FEE_PERCENT_PRECISION`
    uint256 public depositFeePercent;

    /// @dev gap to keep the storage ordering, replace `uint256 public DEPOSIT_FEE_PERCENT_PRECISION;`
    uint256[1] private __gap1;

    /// @notice The precision of `depositFeePercent`
    uint256 public constant DEPOSIT_FEE_PERCENT_PRECISION = 1e18;

    /// @notice Accumulated `token` rewards per share, scaled to `ACC_REWARD_PER_SHARE_PRECISION`
    mapping(IERC20Upgradeable => uint256) public accRewardPerShare;

    /// @dev gap to keep the storage ordering, replace `uint256 public ACC_REWARD_PER_SHARE_PRECISION;`
    uint256[1] private __gap3;

    /// @notice The precision of `accRewardPerShare`
    uint256 public constant ACC_REWARD_PER_SHARE_PRECISION = 1e24;

    /// @dev Info of each user that stakes TGT
    mapping(address => UserInfo) private userInfo;

    ISwapRouter public constant swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 public constant poolFee = 500;
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    /// @notice Emitted when a user deposits TGT
    event Deposit(address indexed user, uint256 amount, uint256 fee);

    /// @notice Emitted when owner changes the deposit fee percentage
    event DepositFeeChanged(uint256 newFee, uint256 oldFee);

    /// @notice Emitted when a user withdraws TGT
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Emitted when a user claims reward
    event ClaimReward(address indexed user, address indexed rewardToken, uint256 amount);

    /// @notice Emitted when a user emergency withdraws its TGT
    event EmergencyWithdraw(address indexed user, uint256 amount);

    /// @notice Emitted when owner adds a token to the reward tokens list
    event RewardTokenAdded(address token);

    /// @notice Emitted when owner removes a token from the reward tokens list
    event RewardTokenRemoved(address token);

    /// @notice Emitted when owner sweeps a token
    event TokenSwept(address token, address to, uint256 amount);

    /**
     * @notice Reentrancy guard
     */
    modifier nonReentrant() {
        require(!reentrant, "TGTStakingBasic: reentrant call");
        reentrant = true;
        _;
        reentrant = false;
    }

    /**
     * @notice Initialize a new TGTStakingBasic contract
     * @dev This contract needs to receive an ERC20 `_rewardToken` in order to distribute them
          * @param _tgt The address of the TGT token
     * @param _rewardToken The address of the ERC20 reward token
     * @param _feeCollector The address where deposit fees will be sent
     * @param _depositFeePercent The deposit fee percent, scalled to 1e18, e.g. 3% is 3e16
     */
    function initialize(
        IERC20Upgradeable _tgt,
        IERC20Upgradeable _rewardToken,
        address _feeCollector,
        uint256 _depositFeePercent
    ) external initializer {
        __Ownable_init(_msgSender());
        require(address(_tgt) != address(0), "TGTStakingBasic: tgt can't be address(0)");
        require(address(_rewardToken) != address(0), "TGTStakingBasic: reward token can't be address(0)");
        require(_feeCollector != address(0), "TGTStakingBasic: fee collector can't be address(0)");
        require(_depositFeePercent <= 5e17, "TGTStakingBasic: max deposit fee can't be greater than 50%");

        tgt = _tgt;
        depositFeePercent = _depositFeePercent;
        feeCollector = _feeCollector;

        isRewardToken[_rewardToken] = true;
        rewardTokens.push(_rewardToken);
    }

    /**
     * @notice Deposit TGT for reward token allocation
     * @param _amount The amount of TGT to deposit
     */
    function deposit(uint256 _amount) external nonReentrant {
        _deposit(_amount, _msgSender(), true);
    }

    function _deposit(uint256 _amount, address _user, bool transferRequired) internal {
        UserInfo storage user = userInfo[_user];

        uint256 _fee = _amount.mul(depositFeePercent).div(DEPOSIT_FEE_PERCENT_PRECISION);
        uint256 _amountMinusFee = _amount.sub(_fee);

        uint256 _previousAmount = user.amount;
        uint256 _newAmount = user.amount.add(_amountMinusFee);
        user.amount = _newAmount;

        uint256 _len = rewardTokens.length;
        for (uint256 i; i < _len; i++) {
            IERC20Upgradeable _token = rewardTokens[i];
            _updateReward(_token);

            uint256 _previousRewardDebt = user.rewardDebt[_token];
            user.rewardDebt[_token] = _newAmount.mul(accRewardPerShare[_token]).div(ACC_REWARD_PER_SHARE_PRECISION);

            if (_previousAmount != 0) {
                uint256 _pending = _previousAmount
                    .mul(accRewardPerShare[_token])
                    .div(ACC_REWARD_PER_SHARE_PRECISION)
                    .sub(_previousRewardDebt);
                if (_pending != 0) {
                    _safeTokenTransfer(_token, _user, _pending);
                    emit ClaimReward(_user, address(_token), _pending);
                }
            }
        }

        internalTgtBalance = internalTgtBalance.add(_amountMinusFee);

        if (transferRequired) {
            if (_fee > 0) tgt.safeTransferFrom(_user, feeCollector, _fee);
            if (_amountMinusFee > 0) tgt.safeTransferFrom(_user, address(this), _amountMinusFee);
        } else {
            if (_fee > 0) tgt.safeTransfer( feeCollector, _fee);
        }

        emit Deposit(_user, _amountMinusFee, _fee);
    }

    /**
    *
    @notice Swaps reward tokens to TGT and restakes them
    */
    function restakeRewards() external {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            IERC20Upgradeable _token = rewardTokens[i];
            address userAddress = _msgSender();
            _updateReward(_token);

            uint256 _pending = pendingReward(userAddress, _token);
            if (_pending > 0) {
                uint256 swappedAmount = _swapToTgt(_pending, _token);

                UserInfo storage user = userInfo[userAddress];
                user.rewardDebt[_token] = user.amount.mul(accRewardPerShare[_token]).div(ACC_REWARD_PER_SHARE_PRECISION);
                lastRewardBalance[_token] -= _pending;

                //restakes the swapped TGT
                _deposit(swappedAmount, userAddress, false);
            }
        }
    }

    /**
    * @notice Uses uniswap v3 pool to swap from reward token to TGT
    * @param _amount The amount of reward token to swap
    * @param _token The address of the reward token
    */
    function _swapToTgt(uint256 _amount, IERC20Upgradeable _token) internal returns (uint256){
        // msg.sender must approve this contract

//         Approve the router to spend reward token.
        if (_token.allowance(address(this), address(swapRouter)) < _amount)
            TransferHelper.safeApprove(address(_token), address(swapRouter), _amount);

        bytes memory path = abi.encodePacked(address(_token), poolFee, WETH, poolFee, address(tgt));

        ISwapRouter.ExactInputParams memory hopParams = ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: _amount,
            amountOutMinimum: 0
        });

        uint256 amountOut = swapRouter.exactInput(hopParams);

        return amountOut;
    }

    /**
     * @notice Get user info
     * @param _user The address of the user
     * @param _rewardToken The address of the reward token
     * @return The amount of TGT user has deposited
     * @return The reward debt for the chosen token
     */
    function getUserInfo(address _user, IERC20Upgradeable _rewardToken) external view returns (uint256, uint256) {
        UserInfo storage user = userInfo[_user];
        return (user.amount, user.rewardDebt[_rewardToken]);
    }

    /**
     * @notice Get the number of reward tokens
     * @return The length of the array
     */
    function rewardTokensLength() external view returns (uint256) {
        return rewardTokens.length;
    }

    /**
     * @notice Add a reward token
     * @param _rewardToken The address of the reward token
     */
    function addRewardToken(IERC20Upgradeable _rewardToken) external onlyOwner {
        require(
            !isRewardToken[_rewardToken] && address(_rewardToken) != address(0),
            "TGTStakingBasic: token can't be added"
        );
        require(rewardTokens.length < 25, "TGTStakingBasic: list of token too big");
        require(accRewardPerShare[_rewardToken] == 0, "TGTStakingBasic: reward token can't be re-added");

        rewardTokens.push(_rewardToken);
        isRewardToken[_rewardToken] = true;

        emit RewardTokenAdded(address(_rewardToken));
    }

    /**
     * @notice Remove a reward token
     * @param _rewardToken The address of the reward token
     */
    function removeRewardToken(IERC20Upgradeable _rewardToken) external onlyOwner {
        require(isRewardToken[_rewardToken], "TGTStakingBasic: token can't be removed");
        isRewardToken[_rewardToken] = false;
        uint256 _len = rewardTokens.length;
        for (uint256 i; i < _len; i++) {
            if (rewardTokens[i] == _rewardToken) {
                rewardTokens[i] = rewardTokens[_len - 1];
                rewardTokens.pop();
                break;
            }
        }
        emit RewardTokenRemoved(address(_rewardToken));
    }

    /**
     * @notice Set the deposit fee percent
     * @param _depositFeePercent The new deposit fee percent
     */
    function setDepositFeePercent(uint256 _depositFeePercent) external onlyOwner {
        require(_depositFeePercent <= 5e17, "TGTStakingBasic: deposit fee can't be greater than 50%");
        uint256 oldFee = depositFeePercent;
        depositFeePercent = _depositFeePercent;
        emit DepositFeeChanged(_depositFeePercent, oldFee);
    }

    /**
     * @notice View function to see pending reward token on frontend
     * @param _user The address of the user
     * @param _token The address of the token
     * @return `_user`'s pending reward token
     */
    function pendingReward(address _user, IERC20Upgradeable _token) public view returns (uint256) {
        require(isRewardToken[_token], "TGTStakingBasic: wrong reward token");
        UserInfo storage user = userInfo[_user];
        uint256 _totalTgt = internalTgtBalance;
        uint256 _accRewardTokenPerShare = accRewardPerShare[_token];

        uint256 _currRewardBalance = _token.balanceOf(address(this));
        uint256 _rewardBalance = _token == tgt ? _currRewardBalance.sub(_totalTgt) : _currRewardBalance;

        if (_rewardBalance != lastRewardBalance[_token] && _totalTgt != 0) {
            uint256 _accruedReward = _rewardBalance.sub(lastRewardBalance[_token]);
            _accRewardTokenPerShare = _accRewardTokenPerShare.add(
                _accruedReward.mul(ACC_REWARD_PER_SHARE_PRECISION).div(_totalTgt)
            );
        }
        return
            user.amount.mul(_accRewardTokenPerShare).div(ACC_REWARD_PER_SHARE_PRECISION).sub(user.rewardDebt[_token]);
    }

    /**
     * @notice Withdraw TGT and harvest the rewards
     * @param _amount The amount of TGT to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant {
        _withdraw(_amount, _msgSender());
    }

    function _withdraw(uint256 _amount, address _user) internal {
        UserInfo storage user = userInfo[_user];
        uint256 _previousAmount = user.amount;

        require(_amount <= _previousAmount, "TGTStakingBasic: withdraw amount exceeds balance");
        uint256 _newAmount = user.amount.sub(_amount);
        user.amount = _newAmount;

        uint256 _len = rewardTokens.length;
        if (_previousAmount != 0) {
            for (uint256 i; i < _len; i++) {
                IERC20Upgradeable _token = rewardTokens[i];
                _updateReward(_token);

                uint256 _pending = _previousAmount
                    .mul(accRewardPerShare[_token])
                    .div(ACC_REWARD_PER_SHARE_PRECISION)
                    .sub(user.rewardDebt[_token]);
                user.rewardDebt[_token] = _newAmount.mul(accRewardPerShare[_token]).div(ACC_REWARD_PER_SHARE_PRECISION);

                if (_pending != 0) {
                    _safeTokenTransfer(_token, _user, _pending);
                    emit ClaimReward(_msgSender(), address(_token), _pending);
                }
            }
        }

        internalTgtBalance = internalTgtBalance.sub(_amount);
        tgt.safeTransfer(_user, _amount);
        emit Withdraw(_user, _amount);
    }

    /**
     * @notice Withdraw without caring about rewards. EMERGENCY ONLY
     */
    function emergencyWithdraw() external nonReentrant {
        UserInfo storage user = userInfo[_msgSender()];

        uint256 _amount = user.amount;

        require(_amount > 0, "TGTStakingBasic: can't withdraw 0");

        user.amount = 0;
        uint256 _len = rewardTokens.length;
        for (uint256 i; i < _len; i++) {
            IERC20Upgradeable _token = rewardTokens[i];
            user.rewardDebt[_token] = 0;
        }
        internalTgtBalance = internalTgtBalance.sub(_amount);
        tgt.safeTransfer(_msgSender(), _amount);
        emit EmergencyWithdraw(_msgSender(), _amount);
    }

    /**
     * @dev Update reward variables
     * Needs to be called before any deposit or withdrawal
     * @param _token The address of the reward token
     */
    function _updateReward(IERC20Upgradeable _token) internal {
        require(isRewardToken[_token], "TGTStakingBasic: wrong reward token");

        uint256 _totalTgt = internalTgtBalance;

        uint256 _currRewardBalance = _token.balanceOf(address(this));
        uint256 _rewardBalance = _token == tgt ? _currRewardBalance.sub(_totalTgt) : _currRewardBalance;

        // Did TGTStakingBasic receive any token
        if (_rewardBalance == lastRewardBalance[_token] || _totalTgt == 0) {
            return;
        }

        uint256 _accruedReward = _rewardBalance.sub(lastRewardBalance[_token]);

        accRewardPerShare[_token] = accRewardPerShare[_token].add(
            _accruedReward.mul(ACC_REWARD_PER_SHARE_PRECISION).div(_totalTgt)
        );
        lastRewardBalance[_token] = _rewardBalance;
    }

    /**
     * @notice Sweep token to the `_to` address
     * @param _token The address of the token to sweep
     * @param _to The address that will receive `_token` balance
     */
    function sweep(IERC20Upgradeable _token, address _to) external onlyOwner {
        require(!isRewardToken[_token] && address(_token) != address(tgt), "TGTStakingBasic: token can't be swept");

        uint256 _balance = _token.balanceOf(address(this));

        require(_balance > 0, "TGTStakingBasic: can't sweep 0");

        _token.safeTransfer(_to, _balance);

        emit TokenSwept(address(_token), _to, _balance);
    }

    /**
     * @dev Safe token transfer function, just in case if rounding error
     * causes pool to not have enough reward tokens
     * @param _token The address of then token to transfer
     * @param _to The address that will receive `_amount` `rewardToken`
     * @param _amount The amount to send to `_to`
     */
    function _safeTokenTransfer(
        IERC20Upgradeable _token,
        address _to,
        uint256 _amount
    ) internal {
        uint256 _currRewardBalance = _token.balanceOf(address(this));
        uint256 _rewardBalance = _token == tgt ? _currRewardBalance.sub(internalTgtBalance) : _currRewardBalance;

        if (_amount > _rewardBalance) {
            lastRewardBalance[_token] = lastRewardBalance[_token].sub(_rewardBalance);
            _token.safeTransfer(_to, _rewardBalance);
        } else {
            lastRewardBalance[_token] = lastRewardBalance[_token].sub(_amount);
            _token.safeTransfer(_to, _amount);
        }
    }
}
