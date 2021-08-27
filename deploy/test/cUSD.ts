import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	await deploy("TokenMock", {
		from: deployer,
		args: ["cUSD", "cUSD"],
		log: true,
	});
};

export default func;
func.tags = ["cUSDTest", "Test"];
