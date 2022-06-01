import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const ImpactProxyAdminContract = await deployments.get("ImpactProxyAdmin");

	const implementationResult = await deploy(
		"ImpactMarketCouncilImplementation",
		{
			from: deployer,
			log: true,
		}
	);

	const proxyResult = await deploy("ImpactMarketCouncilProxy", {
		from: deployer,
		args: [implementationResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	const impactMarketCouncil = await ethers.getContractAt(
		"ImpactMarketCouncilImplementation",
		proxyResult.address
	);

	const communityAdminProxy = await deployments.get("CommunityAdminProxy");

	await impactMarketCouncil.initialize(1, communityAdminProxy.address, [
		deployer,
	]);
};

func.dependencies = ["ImpactProxyAdminTest", "CommunityTest"];
func.tags = ["ImpactMarketCouncilTest", "Test"];
export default func;
