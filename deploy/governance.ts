import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { BigNumberish } from "ethers";

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 17280; // about 1 day
const VOTING_DELAY_BLOCKS = 17280 * 2; // about 2 days
const PROPOSAL_THRESHOLD: BigNumberish = parseEther("1000000"); // one million units

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
	console.log(
		`Next contract address for deployer ${deployer} at nonce ${nonce} (offset ${offset}) is ${nextAddress}`
	);
	return nextAddress;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const delegatorAddress = await getContractAddress(hre, deployer, 0);
	const timelockAddress = await getContractAddress(hre, deployer, 1);
	const delegateAddress = await getContractAddress(hre, deployer, 2);

	const Token = await deployments.get("IPCTToken");

	const delegatorResult = await deploy("IPCTDelegator", {
		from: deployer,
		args: [
			timelockAddress,
			Token.address,
			Token.address,
			deployer,
			delegateAddress,
			VOTING_PERIOD_BLOCKS,
			VOTING_DELAY_BLOCKS,
			PROPOSAL_THRESHOLD,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const timelockResult = await deploy("IPCTTimelock", {
		from: deployer,
		args: [delegatorAddress, TWO_DAYS_SECONDS],
		log: true,
		// gasLimit: 13000000,
	});

	const delegateResult = await deploy("IPCTDelegate", {
		from: deployer,
		log: true,
		// gasLimit: 13000000,
	});
};

func.dependencies = ["Token"];
func.tags = ["Governance"];
export default func;
