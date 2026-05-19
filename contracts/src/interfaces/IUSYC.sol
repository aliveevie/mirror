// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";

/// @notice Minimal interface for the USYC yield wrapper used by IdleReserve.
/// Real USYC has additional surface; Mirror only depends on these calls.
interface IUSYC is IERC20 {
    function deposit(uint256 usdcAmount) external returns (uint256 usycMinted);
    function redeem(uint256 usycAmount) external returns (uint256 usdcReturned);
    function exchangeRate() external view returns (uint256); // 1e18 fixed
}
