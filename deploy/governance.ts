import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { BigNumberish } from "ethers";

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 17280;
const VOTING_DELAY_BLOCKS = 720; // about 1 hour
const PROPOSAL_THRESHOLD: BigNumberish = parseEther("100000000"); // 100 millions units (1%)
const QUORUM_VOTES: BigNumberish = parseEther("400000000"); // 400 millions units (4%)

async function getContractAddress(
	hre: HardhatRuntimeEnvironment,
	deployer: string,
	offset = 0
) {
	const deployerNonce = await hre.ethers.provider.getTransactionCount(
		deployer
	);
	const nonce: BigNumberish = deployerNonce + offset;
	const nextAddress = hre.ethers.utils.getContractAddress({
		from: deployer,
		nonce: nonce,
	});
	return nextAddress;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const delegateAddress = await getContractAddress(hre, deployer, 0);
	const timelockAddress = await getContractAddress(hre, deployer, 1);
	const delegatorAddress = await getContractAddress(hre, deployer, 2);

	const Token = await deployments.get("IPCTToken");

	const delegateResult = await deploy("IPCTDelegate", {
		from: deployer,
		log: true,
	});

	const timelockResult = await deploy("IPCTTimelock", {
		from: deployer,
		args: [delegatorAddress, TWO_DAYS_SECONDS],
		log: true,
	});

	const delegatorResult = await deploy("IPCTDelegator", {
		from: deployer,
		args: [
			timelockAddress,
			Token.address,
			Token.address,
			timelockAddress,
			delegateAddress,
			VOTING_PERIOD_BLOCKS,
			VOTING_DELAY_BLOCKS,
			PROPOSAL_THRESHOLD,
			QUORUM_VOTES,
		],
		log: true,
	});
};

func.dependencies = ["TokenProd"];
func.tags = ["GovernanceProd", "Prod"];
export default func;
