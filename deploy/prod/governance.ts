import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { BigNumberish } from "ethers";

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 17280;
const VOTING_DELAY_BLOCKS = 720; // about 1 hour
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

	const delegateResult = await deploy("PACTDelegate", {
		from: deployer,
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const delegatorResult = await deploy("PACTDelegator", {
		from: deployer,
		args: [delegateResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const timelockResult = await deploy("PACTTimelock", {
		from: deployer,
		args: [delegatorResult.address, TWO_DAYS_SECONDS],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const governance = await ethers.getContractAt(
		"PACTDelegate",
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

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const PACT = await deployments.get("PACTToken");
	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);
	await PACTContract.transfer(
		delegatorResult.address,
		parseEther("2000000000")
	);

	// only for prod
	await governance.transferOwnership(timelockResult.address);
	const ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		ImpactProxyAdminContract.address
	);
	await ImpactProxyAdmin.transferOwnership(timelockResult.address);

	await new Promise((resolve) => setTimeout(resolve, 6000));
};

func.dependencies = ["TokenProd", "ImpactProxyAdminProd"];
func.tags = ["GovernanceProd", "Prod"];
export default func;
