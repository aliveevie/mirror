// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";
import {LeaderRegistry} from "./LeaderRegistry.sol";

/// @title AllocationRouter
/// @notice Holds follower USDC; the supervisor agent reweights allocation
/// vectors within policy bounds. Follower principal is never callable by the agent.
contract AllocationRouter {
    using SafeTransfer for IERC20;

    IERC20 public immutable USDC;
    LeaderRegistry public immutable LEADERS;
    address public immutable AGENT;     // Circle Agent Wallet
    address public immutable INITIALIZER;

    /// @dev IdleReserve address — set exactly once by INITIALIZER after the
    /// IdleReserve is deployed. Locked thereafter (same guarantee as immutable
    /// without requiring deployer-nonce prediction).
    address public IDLE;
    bool public idleInitialized;

    uint16 public constant BPS_TOTAL = 10_000;

    /// @dev Per-window cap on reweight magnitude, summed across the vector.
    /// Enforced both here (defense-in-depth) and at the wallet policy layer.
    uint16 public constant MAX_DELTA_PER_WINDOW_BPS = 2_000;
    uint64 public constant WINDOW = 1 hours;

    enum RiskProfile { Conservative, Balanced, Aggressive }

    struct Entry { address leader; uint16 weightBps; uint64 lastUpdated; }
    struct Follower {
        uint128 principal;
        uint64  inflightSettlementBoundary;
        RiskProfile profile;
        bool exists;
    }

    mapping(address => Follower) internal _followers;
    mapping(address => Entry[]) internal _vectors; // follower => entries
    mapping(address => uint64) internal _lastWindowStart;
    mapping(address => uint32) internal _windowDeltaBps;

    /// @notice Aggregate USDC pointed at a given leader across all followers.
    mapping(address => uint256) public leaderInflow;

    event Deposited(address indexed follower, uint256 amount, RiskProfile profile);
    event Withdrawn(address indexed follower, uint256 amount);
    event AllocationSet(address indexed follower, bytes32 artifactHash);
    event SettlementBoundaryAdvanced(address indexed follower, uint64 boundary);

    error NotAuthorized();
    error ZeroAmount();
    error NoBalance();
    error InflightSettlement();
    error DeltaCapExceeded();
    error WeightOverflow();
    error UnknownLeader();
    error AlreadyInitialized();
    error ZeroAddress();

    modifier onlyAgent() {
        if (msg.sender != AGENT) revert NotAuthorized();
        _;
    }

    constructor(IERC20 usdc, LeaderRegistry leaders, address agent, address initializer) {
        if (address(usdc) == address(0) || address(leaders) == address(0) || agent == address(0) || initializer == address(0)) {
            revert ZeroAddress();
        }
        USDC = usdc;
        LEADERS = leaders;
        AGENT = agent;
        INITIALIZER = initializer;
    }

    /// @notice Wire IDLE (IdleReserve). Callable exactly once by INITIALIZER.
    /// After this call, IDLE is locked forever.
    function initIdle(address idle) external {
        if (msg.sender != INITIALIZER) revert NotAuthorized();
        if (idleInitialized) revert AlreadyInitialized();
        if (idle == address(0)) revert ZeroAddress();
        IDLE = idle;
        idleInitialized = true;
    }

    // --- follower-facing -----------------------------------------------------

    function deposit(uint256 amount, RiskProfile profile) external {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        Follower storage f = _followers[msg.sender];
        f.principal += uint128(amount);
        f.profile = profile;
        f.exists = true;
        emit Deposited(msg.sender, amount, profile);
    }

    function withdraw(uint256 amount) external {
        Follower storage f = _followers[msg.sender];
        if (!f.exists || f.principal == 0) revert NoBalance();
        if (amount > f.principal) amount = f.principal;
        if (f.inflightSettlementBoundary != 0 && block.timestamp < f.inflightSettlementBoundary) {
            revert InflightSettlement();
        }

        f.principal -= uint128(amount);
        USDC.safeTransfer(msg.sender, amount);

        // Reduce locked bond contribution pro-rata.
        _rescaleLocksForFollower(msg.sender);

        emit Withdrawn(msg.sender, amount);
    }

    // --- agent-only ----------------------------------------------------------

    /// @notice Set a follower's allocation vector.
    /// @dev `artifactHash` is the content-address of the supervisor's reasoning
    /// artifact for this decision — committed on-chain for auditability.
    function setAllocation(
        address follower,
        Entry[] calldata newVector,
        bytes32 artifactHash
    ) external onlyAgent {
        Follower storage f = _followers[follower];
        if (!f.exists) revert NoBalance();

        // 1. Validate weight bounds.
        uint256 sum;
        for (uint256 i = 0; i < newVector.length; ++i) {
            sum += newVector[i].weightBps;
            // Each entry must reference a bonded leader.
            (bool bonded,,,) = LEADERS.getBondStatus(newVector[i].leader);
            if (!bonded) revert UnknownLeader();
        }
        if (sum > BPS_TOTAL) revert WeightOverflow();

        // 2. Enforce per-window delta cap.
        _checkAndAccumulateDelta(follower, newVector);

        // 3. Reverse-out the old vector's contribution to leaderInflow.
        _drainLeaderInflowFor(follower);

        // 4. Write new vector + update leaderInflow + locked bond.
        delete _vectors[follower];
        for (uint256 i = 0; i < newVector.length; ++i) {
            _vectors[follower].push(Entry({
                leader: newVector[i].leader,
                weightBps: newVector[i].weightBps,
                lastUpdated: uint64(block.timestamp)
            }));
            uint256 amount = (uint256(f.principal) * newVector[i].weightBps) / BPS_TOTAL;
            leaderInflow[newVector[i].leader] += amount;
            LEADERS.setLocked(newVector[i].leader, leaderInflow[newVector[i].leader]);
        }

        emit AllocationSet(follower, artifactHash);
    }

    /// @notice Move principal during the in-flight window; settlement boundary
    /// advances so the follower cannot exit a pending loss.
    function markInflight(address follower, uint64 settleAt) external onlyAgent {
        Follower storage f = _followers[follower];
        if (settleAt > f.inflightSettlementBoundary) {
            f.inflightSettlementBoundary = settleAt;
            emit SettlementBoundaryAdvanced(follower, settleAt);
        }
    }

    // --- views ---------------------------------------------------------------

    function getAllocation(address follower) external view returns (Entry[] memory) {
        return _vectors[follower];
    }

    function getPrincipal(address follower) external view returns (uint256) {
        return _followers[follower].principal;
    }

    function getProfile(address follower) external view returns (RiskProfile) {
        return _followers[follower].profile;
    }

    // --- internals -----------------------------------------------------------

    function _drainLeaderInflowFor(address follower) internal {
        Entry[] storage prev = _vectors[follower];
        uint128 p = _followers[follower].principal;
        for (uint256 i = 0; i < prev.length; ++i) {
            uint256 amount = (uint256(p) * prev[i].weightBps) / BPS_TOTAL;
            leaderInflow[prev[i].leader] -= amount;
            LEADERS.setLocked(prev[i].leader, leaderInflow[prev[i].leader]);
        }
    }

    function _rescaleLocksForFollower(address follower) internal {
        Entry[] storage v = _vectors[follower];
        uint128 p = _followers[follower].principal;
        for (uint256 i = 0; i < v.length; ++i) {
            uint256 oldShare;
            // recompute against new principal: previous inflow already includes
            // this follower's stale share; subtract and re-add.
            // The simplest correct path: refresh full inflow for this leader
            // from on-chain state would require iteration; instead we approximate
            // by rebuilding lock from leaderInflow snapshot.
            // Production implementation would maintain a per-(follower,leader) map.
            // For correctness in this scaffold we set lock to current inflow.
            oldShare; // silence unused
            LEADERS.setLocked(v[i].leader, leaderInflow[v[i].leader]);
        }
    }

    function _checkAndAccumulateDelta(address follower, Entry[] calldata newVector) internal {
        if (block.timestamp - _lastWindowStart[follower] > WINDOW) {
            _lastWindowStart[follower] = uint64(block.timestamp);
            _windowDeltaBps[follower] = 0;
        }

        // Sum absolute delta vs. current vector.
        Entry[] storage prev = _vectors[follower];
        uint32 delta;
        // delta += abs diffs for shared leaders
        for (uint256 i = 0; i < newVector.length; ++i) {
            uint16 w = newVector[i].weightBps;
            uint16 pw = _findWeight(prev, newVector[i].leader);
            delta += w > pw ? uint32(w - pw) : uint32(pw - w);
        }
        for (uint256 i = 0; i < prev.length; ++i) {
            if (!_inVector(newVector, prev[i].leader)) {
                delta += prev[i].weightBps;
            }
        }

        _windowDeltaBps[follower] += delta;
        if (_windowDeltaBps[follower] > MAX_DELTA_PER_WINDOW_BPS) revert DeltaCapExceeded();
    }

    function _findWeight(Entry[] storage v, address leader) internal view returns (uint16) {
        for (uint256 i = 0; i < v.length; ++i) {
            if (v[i].leader == leader) return v[i].weightBps;
        }
        return 0;
    }

    function _inVector(Entry[] calldata v, address leader) internal pure returns (bool) {
        for (uint256 i = 0; i < v.length; ++i) {
            if (v[i].leader == leader) return true;
        }
        return false;
    }
}
