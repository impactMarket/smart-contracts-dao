import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { BigNumberish } from "ethers";

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 720; // about 1 hour
const VOTING_DELAY_BLOCKS = 1; // about 5 seconds
const PROPOSAL_THRESHOLD: BigNumberish = parseEther("100000000"); // 100 millions units (1%)
const QUORUM_VOTES: BigNumberish = parseEther("100000000"); // 100 millions units (1%)

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const Token = await deployments.get("PACTToken");
	const StakingToken = await deployments.get("SPACTToken");
	const ImpactProxyAdminContract = await deployments.get("ImpactProxyAdmin");

	const delegateResult = await deploy("PACTDelegate", {
		from: deployer,
		log: true,
	});

	const delegatorResult = await deploy("PACTDelegator", {
		from: deployer,
		args: [delegateResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	const timelockResult = await deploy("PACTTimelock", {
		from: deployer,
		args: [delegatorResult.address, TWO_DAYS_SECONDS],
		log: true,
	});

	const governance = await ethers.getContractAt(
		"PACTDelegate",
		delegatorResult.address
	);

	await governance.initialize(
		timelockResult.address,
		Token.address,
		StakingToken.address,
		VOTING_PERIOD_BLOCKS,
		VOTING_DELAY_BLOCKS,
		PROPOSAL_THRESHOLD,
		QUORUM_VOTES
	);

	const PACT = await deployments.get("PACTToken");
	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);

	// only for prod
	// await PACTContract.transfer(
	// 	delegatorResult.address,
	// 	parseEther("2000000000")
	// );
	//
	// const ImpactProxyAdmin = await ethers.getContractAt(
	// 	"ImpactProxyAdmin",
	// 	ImpactProxyAdminContract.address
	// );
	// await ImpactProxyAdmin.transferOwnership(timelockAddress);
};

func.dependencies = ["PactTest", "StakingPactTest", "ImpactProxyAdminTest"];
func.tags = ["GovernanceTest", "Test"];
export default func;
