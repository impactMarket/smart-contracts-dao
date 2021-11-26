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


	const delegateResult = await deploy("IPCTDelegate", {
		from: deployer,
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const delegatorResult = await deploy("IPCTDelegator", {
		from: deployer,
		args: [
			delegateResult.address,
			ImpactProxyAdminContract.address,
		],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const timelockResult = await deploy("IPCTTimelock", {
		from: deployer,
		args: [delegatorResult.address, TWO_DAYS_SECONDS],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const delegate = await ethers.getContractAt(
		"IPCTDelegate",
		delegatorResult.address
	);

	await delegate.initialize(
		timelockResult.address,
		Token.address,
		ZERO_ADDRESS,
		VOTING_PERIOD_BLOCKS,
		VOTING_DELAY_BLOCKS,
		PROPOSAL_THRESHOLD,
		QUORUM_VOTES,
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const IPCT = await deployments.get("PACTToken");
	const IPCTContract = await ethers.getContractAt("PACTToken", IPCT.address);
	await IPCTContract.transfer(delegatorResult.address, parseEther("2000000000"));
	const airgrabAddress = delegatorResult.address;
	await IPCTContract.transfer(airgrabAddress, parseEther("1000000000"));

	// only for prod
	await delegate.transferOwnership(timelockResult.address);
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
