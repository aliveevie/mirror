// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

/// @title BuilderFeeWrapper
/// @notice Stamps the protocol's builder code on outbound venue intents and
/// accrues fee revenue from venues that settle builder rebates back to USDC on Arc.
contract BuilderFeeWrapper {
    using SafeTransfer for IERC20;

    IERC20 public immutable USDC;
    address public immutable EXECUTOR;     // execution-plane caller
    address public immutable AGENT;        // can claim operational wallet share
    address public immutable TREASURY;
    address public immutable REBATE_POOL;
    address public immutable AGENT_OPS_WALLET;

    bytes32 public immutable BUILDER_CODE;

    /// @dev Fee split in bps. Must sum to 10_000.
    uint16 public constant SPLIT_TREASURY_BPS = 4_000;
    uint16 public constant SPLIT_AGENT_BPS    = 2_000;
    uint16 public constant SPLIT_REBATE_BPS   = 4_000;

    uint256 public accruedTreasury;
    uint256 public accruedAgent;
    uint256 public accruedRebate;

    event Attributed(bytes32 indexed venueId, bytes32 builderCode, bytes payload);
    event FeesAccrued(uint256 amount);
    event FeesClaimed(address indexed recipient, uint256 amount);

    error NotAuthorized();

    constructor(
        IERC20 usdc,
        address executor,
        address agent,
        address treasury,
        address rebatePool,
        address agentOpsWallet,
        bytes32 builderCode
    ) {
        USDC = usdc;
        EXECUTOR = executor;
        AGENT = agent;
        TREASURY = treasury;
        REBATE_POOL = rebatePool;
        AGENT_OPS_WALLET = agentOpsWallet;
        BUILDER_CODE = builderCode;
    }

    /// @notice Called by the execution plane immediately before submitting to a venue.
    /// Off-chain venue settles builder fees periodically into this contract.
    function attribute(bytes32 venueId, bytes calldata payload) external {
        if (msg.sender != EXECUTOR) revert NotAuthorized();
        emit Attributed(venueId, BUILDER_CODE, payload);
    }

    /// @notice Anyone may call to pull builder fees that have settled to this contract
    /// from venues. Splits per on-chain schedule.
    function accrueFromBalance() external {
        uint256 unallocated = USDC.balanceOf(address(this)) - (accruedTreasury + accruedAgent + accruedRebate);
        if (unallocated == 0) return;

        accruedTreasury += (unallocated * SPLIT_TREASURY_BPS) / 10_000;
        accruedAgent    += (unallocated * SPLIT_AGENT_BPS)    / 10_000;
        accruedRebate   += unallocated
            - (unallocated * SPLIT_TREASURY_BPS) / 10_000
            - (unallocated * SPLIT_AGENT_BPS)    / 10_000;

        emit FeesAccrued(unallocated);
    }

    function claimTreasury() external {
        if (msg.sender != TREASURY) revert NotAuthorized();
        uint256 amount = accruedTreasury;
        accruedTreasury = 0;
        USDC.safeTransfer(TREASURY, amount);
        emit FeesClaimed(TREASURY, amount);
    }

    function claimAgentOps() external {
        if (msg.sender != AGENT) revert NotAuthorized();
        uint256 amount = accruedAgent;
        accruedAgent = 0;
        USDC.safeTransfer(AGENT_OPS_WALLET, amount);
        emit FeesClaimed(AGENT_OPS_WALLET, amount);
    }

    function claimRebate() external {
        uint256 amount = accruedRebate;
        accruedRebate = 0;
        USDC.safeTransfer(REBATE_POOL, amount);
        emit FeesClaimed(REBATE_POOL, amount);
    }
}
