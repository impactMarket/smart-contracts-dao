import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getCUSDAddress } from "./cUSD";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, ethers } = hre;

	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	// const ownerAddress = IPCTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev
	// const cUSDAddress = getCUSDAddress(); //prod
	const cUSDAddress = getCUSDAddress();

	const communityAdminImplementationResult = await deploy(
		"CommunityAdminImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const communityAdminProxyResult = await deploy("CommunityAdminProxy", {
		from: deployer.address,
		args: [
			communityAdminImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const CommunityAdminContract = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdminProxyResult.address
	);

	const communityResult = await deploy("Community", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	await CommunityAdminContract.initialize(
		communityResult.address,
		cUSDAddress
	);

	const Treasury = await deployments.get("TreasuryProxy");

	const TreasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		Treasury.address
	);

	await CommunityAdminContract.updateTreasury(Treasury.address);

	await TreasuryContract.updateCommunityAdmin(
		communityAdminProxyResult.address
	);

	await CommunityAdminContract.transferOwnership(ownerAddress);
	await TreasuryContract.transferOwnership(ownerAddress);
};

func.dependencies = [
	"ImpactProxyAdminTest",
	"GovernanceTest",
	"TreasuryTest",
	"cUSDTest",
];
func.tags = ["CommunityTest", "Test"];
export default func;
