import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {getCUSDAddress}  from "./cUSD";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	await deploy("Treasury", {
		from: deployer,
		args: [getCUSDAddress(), ZERO_ADDRESS],
		log: true,
	});
};

export default func;
func.dependencies = ["cUSD"];
func.tags = ["Treasury", "Prod"];
