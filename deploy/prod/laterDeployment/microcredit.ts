import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


// //alfajores
// const impactMultiSigProxyAdminAddress = "0x109106C3C20be1320a2677AC14D62E4309f39280";
// const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
// const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";

// mainnet
const impactMultiSigProxyAdminAddress = "0x5e7912f6C052D4D7ec8D6a14330c0c3a538e3f2B";
const cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	//deploy microcredit revenue
	const microcreditRevenueImplementationResult = await deploy(
		"MicrocreditRevenueImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const microcreditRevenueProxyResult = await deploy("MicrocreditRevenueProxy", {
		from: deployer.address,
		args: [microcreditRevenueImplementationResult.address, impactMultiSigProxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const microcreditRevenueContract = await ethers.getContractAt(
		"MicrocreditRevenueImplementation",
		microcreditRevenueProxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await microcreditRevenueContract.initialize();

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await microcreditRevenueContract.transferOwnership(ownerAddress);


	// deploy microcredit
	await new Promise((resolve) => setTimeout(resolve, 6000));
	const microcreditImplementationResult = await deploy(
		"MicrocreditImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const microcreditProxyResult = await deploy("MicrocreditProxy", {
		from: deployer.address,
		args: [microcreditImplementationResult.address, impactMultiSigProxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	const microcreditContract = await ethers.getContractAt(
		"MicrocreditImplementation",
		microcreditProxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await microcreditContract.initialize(
		cUSDAddress,
		microcreditRevenueContract.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await microcreditContract.transferOwnership(ownerAddress);
};

export default func;
func.tags = ["MicrocreditProd"];
