import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import {
	uniswapNFTPositionManagerAddress,
	uniswapQuoterAddress,
	uniswapRouterAddress,
} from "../../test/utils/uniswap";
import { LpStrategy } from "../../test/treasury/treasury.test";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	const treasuryLpSwapImplementationResult = await deploy(
		"TreasuryLpSwapImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const treasuryLpSwapProxyResult = await deploy("TreasuryLpSwapProxy", {
		from: deployer.address,
		args: [
			treasuryLpSwapImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const treasuryLpSwapContract = await ethers.getContractAt(
		"TreasuryLpSwapImplementation",
		treasuryLpSwapProxyResult.address
	);

	const treasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		(
			await deployments.get("TreasuryProxy")
		).address
	);

	await treasuryLpSwapContract.initialize(
		treasuryContract.address,
		uniswapRouterAddress,
		uniswapQuoterAddress,
		uniswapNFTPositionManagerAddress
	);

	await treasuryContract.updateLpSwap(treasuryLpSwapContract.address);
};

export default func;
func.dependencies = ["TreasuryTest"];
func.tags = ["TreasuryLpSwapTest", "Test"];
