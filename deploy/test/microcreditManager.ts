import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { uniswapQuoterAddress} from "../../test/utils/uniswap";
import {toEther} from "../../test/utils/helpers";

const rewardPercentage = toEther(10);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];
	const owner = accounts[1];

	const ImpactMultiSigProxyAdminResult = await deployments.get("ImpactMultiSigProxyAdmin");

	const microcreditContract = await ethers.getContractAt(
		"MicrocreditImplementation",
		(await deployments.get("MicrocreditProxy")).address
	);

	// deploy microcredit
	const microcreditManagerResult = await deploy(
		"MicrocreditManagerImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const microcreditProxyResult = await deploy("MicrocreditManagerProxy", {
		from: deployer.address,
		args: [
			microcreditManagerResult.address,
			ImpactMultiSigProxyAdminResult.address,
		],
		log: true,
	});

	const microcreditManagerContract = await ethers.getContractAt(
		"MicrocreditManagerImplementation",
		microcreditProxyResult.address
	);

	await microcreditManagerContract.initialize(
		rewardPercentage,
		microcreditContract.address,
		uniswapQuoterAddress,
	);

	await microcreditManagerContract.transferOwnership(owner.address);

	await microcreditContract.connect(owner).updateMicrocreditManager(microcreditManagerContract.address);
};

export default func;
func.dependencies = ["ImpactMultiSigProxyAdminTest", "MicrocreditTest"];
func.tags = ["MicrocreditManagerTest"];
