import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	// const owner = deployer; //test
	const owner = (await deployments.get("PACTTimelock")).address; //prod

	await deploy("SPACTToken", {
		from: deployer,
		args: [],
		log: true,
	});
};

export default func;
func.tags = ["StakingTokenProd"];
