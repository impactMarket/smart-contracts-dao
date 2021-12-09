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
	const ImpactProxyAdminContract = await deployments.get("ImpactProxyAdmin");

	const delegateResult = await deploy("IPCTDelegate", {
		from: deployer,
		log: true,
	});

	const delegatorResult = await deploy("IPCTDelegator", {
		from: deployer,
		args: [delegateResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	const timelockResult = await deploy("IPCTTimelock", {
		from: deployer,
		args: [delegatorResult.address, TWO_DAYS_SECONDS],
		log: true,
	});

	const governance = await ethers.getContractAt(
		"IPCTDelegate",
		delegatorResult.address
	);

	await governance.initialize(
		timelockResult.address,
		Token.address,
		ZERO_ADDRESS,
		VOTING_PERIOD_BLOCKS,
		VOTING_DELAY_BLOCKS,
		PROPOSAL_THRESHOLD,
		QUORUM_VOTES
	);

	const IPCT = await deployments.get("PACTToken");
	const IPCTContract = await ethers.getContractAt("PACTToken", IPCT.address);
	await IPCTContract.transfer(
		delegatorResult.address,
		parseEther("2000000000")
	);

	// only for prod
	// await governance.transferOwnership(timelockResult.address);
	// const ImpactProxyAdmin = await ethers.getContractAt(
	// 	"ImpactProxyAdmin",
	// 	ImpactProxyAdminContract.address
	// );
	// await ImpactProxyAdmin.transferOwnership(timelockAddress);
};

func.dependencies = ["TokenTest", "ImpactProxyAdminTest"];
func.tags = ["GovernanceTest", "Test"];
export default func;
