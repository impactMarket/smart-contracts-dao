import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	await new Promise((resolve) => setTimeout(resolve, 6000));

	await deploy("PACTToken", {
		from: deployer,
		args: [deployer],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
};

export default func;
func.tags = ["TokenProd", "Prod"];
