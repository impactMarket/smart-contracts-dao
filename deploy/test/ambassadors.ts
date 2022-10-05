import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployments, ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	// const PACTTimelock = await deployments.get("PACTTimelock"); //prod
	// const ownerAddress = PACTTimelock.address; //prod
	const ownerAddress = deployer; //dev

	const ImpactProxyAdminContract = await deployments.get("ImpactProxyAdmin");

	const implementationResult = await deploy("AmbassadorsImplementation", {
		from: deployer,
		log: true,
	});

	const proxyResult = await deploy("AmbassadorsProxy", {
		from: deployer,
		args: [implementationResult.address, ImpactProxyAdminContract.address],
		log: true,
	});

	const Ambassadors = await ethers.getContractAt(
		"AmbassadorsImplementation",
		proxyResult.address
	);

	const communityAdminProxy = await deployments.get("CommunityAdminProxy");

	await Ambassadors.initialize(communityAdminProxy.address);
	await Ambassadors.transferOwnership(ownerAddress);

	//dependencies
	const CommunityAdmin = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdminProxy.address
	);

	await CommunityAdmin.updateAmbassadors(Ambassadors.address);
};

func.dependencies = ["ImpactProxyAdminTest", "CommunityTest"];
func.tags = ["AmbassadorsTest", "Test"];
export default func;
