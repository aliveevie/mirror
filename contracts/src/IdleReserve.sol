// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IUSYC} from "./interfaces/IUSYC.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

/// @title IdleReserve
/// @notice Wraps idle USDC into USYC for yield. Deposits and redemptions are
/// gated to the AllocationRouter and the supervisor agent.
contract IdleReserve {
    using SafeTransfer for IERC20;

    IERC20 public immutable USDC;
    IUSYC  public immutable USYC;
    address public immutable ROUTER;
    address public immutable AGENT;

    event Deposited(uint256 usdcIn, uint256 usycMinted);
    event Redeemed(uint256 usycIn, uint256 usdcOut);

    error NotAuthorized();

    modifier onlyAgentOrRouter() {
        if (msg.sender != AGENT && msg.sender != ROUTER) revert NotAuthorized();
        _;
    }

    constructor(IERC20 usdc, IUSYC usyc, address router, address agent) {
        USDC = usdc;
        USYC = usyc;
        ROUTER = router;
        AGENT = agent;
    }

    /// @notice Wraps USDC currently in this contract (pushed in by the router) into USYC.
    function deposit(uint256 amount) external onlyAgentOrRouter returns (uint256 minted) {
        USDC.safeApprove(address(USYC), amount);
        minted = USYC.deposit(amount);
        emit Deposited(amount, minted);
    }

    /// @notice Redeems USYC back to USDC and sends it to the router.
    function redeem(uint256 usycAmount) external onlyAgentOrRouter returns (uint256 returned) {
        returned = USYC.redeem(usycAmount);
        USDC.safeTransfer(ROUTER, returned);
        emit Redeemed(usycAmount, returned);
    }

    function totalUsycHeld() external view returns (uint256) {
        return USYC.balanceOf(address(this));
    }
}
