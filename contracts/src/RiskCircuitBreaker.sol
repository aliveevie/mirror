// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LeaderRegistry} from "./LeaderRegistry.sol";

/// @title RiskCircuitBreaker
/// @notice Hysteresis FSM gating bond slashes. State transitions are oracle-driven
/// (the supervisor agent supplies signed telemetry); the contract enforces that
/// a single block cannot both trip and reset.
contract RiskCircuitBreaker {
    LeaderRegistry public immutable LEADERS;
    address public immutable AGENT;
    address public immutable REBATE_POOL;

    enum State { NORMAL, WATCH, ALERT, SLASHING, COOLDOWN }

    struct LeaderState {
        State state;
        uint64 enteredAt;
        uint64 watchAccumulatedSec;
        bytes32 lastArtifactHash;
    }

    /// @dev Hysteresis schedule (bps for drawdown features; seconds for windows).
    uint32 public constant WATCH_ENTER_DD_BPS = 300;   // 3%
    uint32 public constant WATCH_EXIT_DD_BPS  = 150;   // 1.5% (Δ = 1.5%)
    uint32 public constant ALERT_ENTER_DD_BPS = 800;   // 8%
    uint32 public constant ALERT_EXIT_DD_BPS  = 500;   // 5%
    uint64 public constant MIN_WATCH_DURATION = 1 hours;
    uint64 public constant COOLDOWN_DURATION  = 24 hours;

    /// @dev Minimum oracle quorum: at least N independent signals must concur
    /// to advance into ALERT. Enforced via the `confirmingOracles` count.
    uint8 public constant MIN_ORACLE_QUORUM = 2;

    struct Telemetry {
        uint32 drawdownBps;
        uint32 drawdownVelocityBpsPerHour;
        uint32 concentrationHhi;
        uint32 correlationDriftBps;
        uint32 leverageCurrent;
        uint32 leverageDeclaredMax;
        uint8  confirmingOracles;
        bytes32 artifactHash;
    }

    mapping(address => LeaderState) public leaderState;

    event StateTransitioned(address indexed leader, State from, State to, bytes32 artifactHash);
    event SlashExecuted(address indexed leader, uint256 amount, bytes32 artifactHash);

    error NotAuthorized();
    error InvalidState();
    error InsufficientQuorum();
    error WatchDurationNotMet();
    error TripAndResetSameBlock();

    modifier onlyAgent() {
        if (msg.sender != AGENT) revert NotAuthorized();
        _;
    }

    constructor(LeaderRegistry leaders, address agent, address rebatePool) {
        LEADERS = leaders;
        AGENT = agent;
        REBATE_POOL = rebatePool;
    }

    /// @notice Evaluate telemetry and advance the FSM if thresholds are crossed.
    function evaluate(address leader, Telemetry calldata t) external onlyAgent {
        LeaderState storage s = leaderState[leader];

        // A single block cannot both trip and reset.
        if (s.enteredAt == block.timestamp && _isReset(s.state, t)) revert TripAndResetSameBlock();

        State prev = s.state;
        State next = _nextState(s, t);

        if (next != prev) {
            // Quorum gate when escalating into ALERT or SLASHING.
            if ((next == State.ALERT || next == State.SLASHING) && t.confirmingOracles < MIN_ORACLE_QUORUM) {
                revert InsufficientQuorum();
            }
            // ALERT requires a full WATCH window of accumulated evidence.
            if (next == State.ALERT && s.watchAccumulatedSec < MIN_WATCH_DURATION) {
                revert WatchDurationNotMet();
            }
            s.state = next;
            s.enteredAt = uint64(block.timestamp);
            s.lastArtifactHash = t.artifactHash;
            emit StateTransitioned(leader, prev, next, t.artifactHash);
        } else if (prev == State.WATCH) {
            // Accumulate WATCH time across re-evaluations that stay in WATCH.
            s.watchAccumulatedSec += uint64(block.timestamp) - s.enteredAt;
            s.enteredAt = uint64(block.timestamp);
        }
    }

    /// @notice Slash the bond. Callable only from SLASHING; advances to COOLDOWN.
    function executeSlash(address leader, uint256 bps) external onlyAgent {
        LeaderState storage s = leaderState[leader];
        if (s.state != State.SLASHING) revert InvalidState();

        (, uint256 available, uint256 locked,) = LEADERS.getBondStatus(leader);
        uint256 bondTotal = available + locked;
        uint256 amount = (bondTotal * bps) / 10_000;

        uint256 actual = LEADERS.debitSlash(leader, amount, REBATE_POOL);

        s.state = State.COOLDOWN;
        s.enteredAt = uint64(block.timestamp);
        s.watchAccumulatedSec = 0;
        emit SlashExecuted(leader, actual, s.lastArtifactHash);
    }

    function slashProceedsRecipient() external view returns (address) {
        return REBATE_POOL;
    }

    // --- pure FSM ------------------------------------------------------------

    function _nextState(LeaderState storage s, Telemetry calldata t) internal view returns (State) {
        State cur = s.state;

        // COOLDOWN auto-resets after duration.
        if (cur == State.COOLDOWN) {
            if (block.timestamp >= s.enteredAt + COOLDOWN_DURATION) return State.NORMAL;
            return State.COOLDOWN;
        }

        if (cur == State.NORMAL) {
            if (t.drawdownBps >= WATCH_ENTER_DD_BPS) return State.WATCH;
            return State.NORMAL;
        }
        if (cur == State.WATCH) {
            if (t.drawdownBps >= ALERT_ENTER_DD_BPS) return State.ALERT;
            if (t.drawdownBps < WATCH_EXIT_DD_BPS) return State.NORMAL;
            return State.WATCH;
        }
        if (cur == State.ALERT) {
            // Escalation to SLASHING gated by leverage breach OR sustained drawdown.
            if (t.leverageCurrent > t.leverageDeclaredMax) return State.SLASHING;
            if (t.drawdownVelocityBpsPerHour >= 200) return State.SLASHING;
            if (t.drawdownBps < ALERT_EXIT_DD_BPS) return State.WATCH;
            return State.ALERT;
        }
        // SLASHING only transitions on executeSlash → COOLDOWN.
        return cur;
    }

    function _isReset(State cur, Telemetry calldata t) internal pure returns (bool) {
        if (cur == State.WATCH) return t.drawdownBps < WATCH_EXIT_DD_BPS;
        if (cur == State.ALERT) return t.drawdownBps < ALERT_EXIT_DD_BPS;
        return false;
    }
}
