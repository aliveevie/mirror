// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {IERC20} from "../src/interfaces/IERC20.sol";
import {IUSYC} from "../src/interfaces/IUSYC.sol";

import {LeaderRegistry} from "../src/LeaderRegistry.sol";
import {AllocationRouter} from "../src/AllocationRouter.sol";
import {RiskCircuitBreaker} from "../src/RiskCircuitBreaker.sol";
import {BuilderFeeWrapper} from "../src/BuilderFeeWrapper.sol";
import {IdleReserve} from "../src/IdleReserve.sol";

/// @notice Deploys Mirror to Arc testnet. Linear deploy order — no address
/// prediction. Circular dependencies between LeaderRegistry/AllocationRouter
/// and AllocationRouter/IdleReserve are resolved via one-shot init functions
/// that lock the wiring forever.
contract Deploy is Script {
    function run() external {
        IERC20 usdc = IERC20(vm.envAddress("ADDR_USDC"));
        IUSYC usyc = IUSYC(vm.envAddress("ADDR_USYC"));

        address agent = vm.envAddress("AGENT_WALLET");
        address executor = vm.envAddress("EXECUTOR");
        address treasury = vm.envAddress("TREASURY");
        address rebatePool = vm.envAddress("REBATE_POOL");
        address agentOps = vm.envAddress("AGENT_OPS_WALLET");

        vm.startBroadcast();
        address deployer = msg.sender;

        // 1. LeaderRegistry — no contract deps; deployer = initializer.
        LeaderRegistry leaders = new LeaderRegistry(usdc, deployer);

        // 2. AllocationRouter — needs LeaderRegistry (already deployed).
        AllocationRouter router = new AllocationRouter(usdc, leaders, agent, deployer);

        // 3. RiskCircuitBreaker — needs LeaderRegistry.
        RiskCircuitBreaker breaker = new RiskCircuitBreaker(leaders, agent, rebatePool);

        // 4. BuilderFeeWrapper — independent of other Mirror contracts.
        BuilderFeeWrapper builder = new BuilderFeeWrapper(
            usdc, executor, agent, treasury, rebatePool, agentOps, bytes32("MIRROR")
        );

        // 5. IdleReserve — needs AllocationRouter (already deployed).
        IdleReserve idle = new IdleReserve(usdc, usyc, address(router), agent);

        // 6. Lock the circular wiring via one-shot init calls.
        leaders.initWiring(address(breaker), address(router));
        router.initIdle(address(idle));

        // 7. Defensive post-init reads — script reverts if anything is off.
        require(leaders.RISK_BREAKER() == address(breaker), "leaders.RISK_BREAKER mismatch");
        require(leaders.ALLOCATION_ROUTER() == address(router), "leaders.ALLOCATION_ROUTER mismatch");
        require(leaders.initialized(), "leaders not initialized");
        require(router.IDLE() == address(idle), "router.IDLE mismatch");
        require(router.idleInitialized(), "router.IDLE not initialized");

        vm.stopBroadcast();

        console2.log("LeaderRegistry      :", address(leaders));
        console2.log("AllocationRouter    :", address(router));
        console2.log("RiskCircuitBreaker  :", address(breaker));
        console2.log("BuilderFeeWrapper   :", address(builder));
        console2.log("IdleReserve         :", address(idle));
    }
}
