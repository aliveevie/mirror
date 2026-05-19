// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

/// @title LeaderRegistry
/// @notice Manages USDC performance bonds posted by leaders.
/// Bond is held in USDC on Arc; visibility weight in the AllocationRouter
/// is proportional to `available + locked`.
contract LeaderRegistry {
    using SafeTransfer for IERC20;

    IERC20 public immutable USDC;
    address public immutable INITIALIZER;

    /// @dev Wiring addresses — set exactly once by INITIALIZER after sibling
    /// contracts are deployed. Locked thereafter, providing the same security
    /// guarantee as `immutable` without requiring deployer-nonce prediction.
    address public RISK_BREAKER;
    address public ALLOCATION_ROUTER;
    bool public initialized;

    /// @dev Cooling period before a withdrawal request can be settled.
    uint256 public constant WITHDRAW_COOLDOWN = 7 days;

    struct Bond {
        uint128 available;   // freely withdrawable component (post-cooldown)
        uint128 locked;      // locked because allocations point at this leader
        uint128 slashed;     // historical slash total (debit-only counter)
        uint64  withdrawReadyAt;
        bytes32 strategyCommitment;
        bool    exists;
    }

    mapping(address => Bond) internal _bonds;
    address[] public leaders;

    event BondPosted(address indexed leader, uint256 amount, bytes32 strategyCommitment);
    event BondToppedUp(address indexed leader, uint256 amount);
    event BondWithdrawScheduled(address indexed leader, uint64 readyAt);
    event BondWithdrawn(address indexed leader, uint256 amount);
    event BondSlashed(address indexed leader, uint256 amount);
    event BondLockUpdated(address indexed leader, uint256 newLocked);

    error NotAuthorized();
    error AlreadyBonded();
    error NoBond();
    error ZeroAmount();
    error CooldownNotElapsed();
    error WouldUnderflowLocked();
    error AlreadyInitialized();
    error NotInitialized();
    error ZeroAddress();

    modifier onlyBreaker() {
        if (msg.sender != RISK_BREAKER) revert NotAuthorized();
        _;
    }

    modifier onlyRouter() {
        if (msg.sender != ALLOCATION_ROUTER) revert NotAuthorized();
        _;
    }

    constructor(IERC20 usdc, address initializer) {
        if (address(usdc) == address(0) || initializer == address(0)) revert ZeroAddress();
        USDC = usdc;
        INITIALIZER = initializer;
    }

    /// @notice Wire RISK_BREAKER and ALLOCATION_ROUTER. Callable exactly once
    /// by INITIALIZER. After this call, both addresses are locked forever —
    /// same guarantee as `immutable` without requiring address prediction.
    function initWiring(address riskBreaker, address allocationRouter) external {
        if (msg.sender != INITIALIZER) revert NotAuthorized();
        if (initialized) revert AlreadyInitialized();
        if (riskBreaker == address(0) || allocationRouter == address(0)) revert ZeroAddress();
        RISK_BREAKER = riskBreaker;
        ALLOCATION_ROUTER = allocationRouter;
        initialized = true;
    }

    function postBond(uint256 amount, bytes32 strategyCommitment) external {
        if (amount == 0) revert ZeroAmount();
        Bond storage b = _bonds[msg.sender];
        if (b.exists) revert AlreadyBonded();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        b.available = uint128(amount);
        b.strategyCommitment = strategyCommitment;
        b.exists = true;
        leaders.push(msg.sender);

        emit BondPosted(msg.sender, amount, strategyCommitment);
    }

    function topUpBond(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Bond storage b = _bonds[msg.sender];
        if (!b.exists) revert NoBond();

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        b.available += uint128(amount);

        emit BondToppedUp(msg.sender, amount);
    }

    function scheduleWithdraw() external {
        Bond storage b = _bonds[msg.sender];
        if (!b.exists) revert NoBond();
        b.withdrawReadyAt = uint64(block.timestamp + WITHDRAW_COOLDOWN);
        emit BondWithdrawScheduled(msg.sender, b.withdrawReadyAt);
    }

    /// @notice Permissionless withdrawal of the unlocked component, after cooldown.
    function withdrawBond() external {
        Bond storage b = _bonds[msg.sender];
        if (!b.exists) revert NoBond();
        if (b.withdrawReadyAt == 0 || block.timestamp < b.withdrawReadyAt) revert CooldownNotElapsed();
        if (b.locked != 0) revert WouldUnderflowLocked();

        uint256 amount = b.available;
        b.available = 0;
        b.withdrawReadyAt = 0;

        USDC.safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, amount);
    }

    // --- privileged ----------------------------------------------------------

    /// @notice Called by AllocationRouter when follower weight on a leader changes.
    function setLocked(address leader, uint256 newLocked) external onlyRouter {
        Bond storage b = _bonds[leader];
        if (!b.exists) revert NoBond();
        b.locked = uint128(newLocked);
        emit BondLockUpdated(leader, newLocked);
    }

    /// @notice Called by RiskCircuitBreaker.executeSlash.
    /// @return amount actually slashed (clamped to available + locked).
    function debitSlash(address leader, uint256 amount, address recipient)
        external
        onlyBreaker
        returns (uint256)
    {
        Bond storage b = _bonds[leader];
        if (!b.exists) revert NoBond();

        uint256 total = uint256(b.available) + uint256(b.locked);
        if (amount > total) amount = total;

        // Drain `available` first, then `locked`.
        uint256 fromAvail = amount > b.available ? b.available : amount;
        b.available -= uint128(fromAvail);
        uint256 fromLocked = amount - fromAvail;
        b.locked -= uint128(fromLocked);
        b.slashed += uint128(amount);

        USDC.safeTransfer(recipient, amount);
        emit BondSlashed(leader, amount);
        return amount;
    }

    // --- views ---------------------------------------------------------------

    function getBondStatus(address leader)
        external
        view
        returns (bool bonded, uint256 available, uint256 locked, uint256 slashed)
    {
        Bond storage b = _bonds[leader];
        return (b.exists, b.available, b.locked, b.slashed);
    }

    function strategyCommitmentOf(address leader) external view returns (bytes32) {
        return _bonds[leader].strategyCommitment;
    }

    function leaderCount() external view returns (uint256) {
        return leaders.length;
    }
}
