import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const timelockAddress = "0x6d685f10974B1085bfF728faF124B4637477c63F";
	const proxyAdminAddress = "0x63431dDac59f49f0d27E4B5e36D9Aae7c7424D1A";
	const communityAdminProxyAddress = "0xaD8C06F1b2808E7919141A5B818B4D0D5d7A129a";

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const implementationResult = await deploy("AmbassadorsImplementation", {
		from: deployer,
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const proxyResult = await deploy("AmbassadorsProxy", {
		from: deployer,
		args: [implementationResult.address, proxyAdminAddress],
		log: true,
	});

	const Ambassadors = await ethers.getContractAt(
		"AmbassadorsImplementation",
		proxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await Ambassadors.initialize(communityAdminProxyAddress);
	await new Promise((resolve) => setTimeout(resolve, 6000));
	await Ambassadors.transferOwnership(timelockAddress);
};

func.tags = ["AmbassadorsProd"];
export default func;
