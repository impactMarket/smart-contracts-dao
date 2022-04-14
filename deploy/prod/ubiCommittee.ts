import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const committeeMember = deployer; // not recommended to prod

	const timelockAddress = "0x6d685f10974B1085bfF728faF124B4637477c63F";
	const proxyAdminAddress = "0x63431dDac59f49f0d27E4B5e36D9Aae7c7424D1A";
	const communityAdminProxyAddress = "0xaD8C06F1b2808E7919141A5B818B4D0D5d7A129a";

	const implementationResult = await deploy("UBICommitteeImplementation", {
		from: deployer,
		log: true,
	});

	const proxyResult = await deploy("UBICommitteeProxy", {
		from: deployer,
		args: [implementationResult.address, proxyAdminAddress],
		log: true,
	});

	const ubiCommittee = await ethers.getContractAt(
		"UBICommitteeImplementation",
		proxyResult.address
	);

	await ubiCommittee.initialize(
		1,
		communityAdminProxyAddress,
		[committeeMember,]
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await ubiCommittee.transferOwnership(timelockAddress);
};

func.tags = ["UBICommitteeProd"];
export default func;
