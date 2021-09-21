import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	await deploy("TreasuryMock", {
		from: deployer,
		args: [ZERO_ADDRESS],
		log: true,
	});
};

export default func;
func.dependencies = ["cUSDTest"];
func.tags = ["TreasuryTest", "Test"];
