import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const cUSD = await deployments.get("TokenMock");

	const Token = await deployments.get("IPCTToken");
	const Treasury = await deployments.get("Treasury");

	await deploy("DonationMiner", {
		from: deployer,
		args: [cUSD.address, Token.address, 100, 10, 2, 1, Treasury.address],
		log: true,
	});
};

export default func;
func.dependencies = ["TreasuryTest", "cUSDTest"];
func.tags = ["DonationMinerTest", "Test"];
