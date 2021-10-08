import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const ImpactProxyAdminResult = await deploy("ImpactProxyAdmin", {
		from: deployer,
		args: [],
		log: true,
	});

	const ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		ImpactProxyAdminResult.address
	);

	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //only prod
	// await ImpactProxyAdmin.transferOwnership(IPCTTimelock.address); //only prod
};

export default func;
func.dependencies = ["GovernanceAlfajores"];
func.tags = ["ImpactProxyAdminAlfajores", "Alfajores"];
