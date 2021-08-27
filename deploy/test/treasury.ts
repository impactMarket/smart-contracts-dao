import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const cUSD = await deployments.get("TokenMock");

	await deploy("Treasury", {
		from: deployer,
		args: [cUSD.address, deployer, ZERO_ADDRESS],
		log: true,
	});
};

export default func;
func.dependencies = ["GovernanceTest", "cUSDTest"];
func.tags = ["TreasuryTest", "Test"];
