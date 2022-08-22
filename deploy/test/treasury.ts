import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { getCUSDAddress } from "./cUSD";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	const treasuryImplementationResult = await deploy(
		"TreasuryImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const treasuryProxyResult = await deploy("TreasuryProxy", {
		from: deployer.address,
		args: [treasuryImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const treasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		treasuryProxyResult.address
	);

	await treasuryContract.initialize(ZERO_ADDRESS);

	const UniswapRouter = await ethers.getContractAt(
		"UniswapV2Router02",
		(
			await deployments.get("UniswapV2Router02")
		).address
	);

	await treasuryContract.updateUniswapRouter(UniswapRouter.address);

	const cUSDAddress = getCUSDAddress();
	await treasuryContract.setToken(cUSDAddress, 1000, []);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "cUSDTest", "UbeswapTest"];
func.tags = ["TreasuryTest", "Test"];
