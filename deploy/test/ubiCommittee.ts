import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const ImpactProxyAdminContract = await deployments.get("ImpactProxyAdmin");

	const implementationResult = await deploy("UBICommitteeImplementation", {
		from: deployer,
		log: true,
	});

	const proxyResult = await deploy("UBICommitteeProxy", {
		from: deployer,
		args: [implementationResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	const ubiCommittee = await ethers.getContractAt(
		"UBICommitteeImplementation",
		proxyResult.address
	);

	const communityAdminProxy = await deployments.get("CommunityAdminProxy");

	await ubiCommittee.initialize(1, communityAdminProxy.address, [deployer]);
};

func.dependencies = ["ImpactProxyAdminTest", "CommunityTest"];
func.tags = ["UBICommitteeTest", "Test"];
export default func;
