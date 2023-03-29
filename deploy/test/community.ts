import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getCUSDAddress } from "./cUSD";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { toEther } from "../../test/utils/helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, ethers } = hre;

	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	// const PACTTimelock = await deployments.get("PACTTimelock"); //prod
	// const ownerAddress = PACTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev
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

	const communityImplementationResult = await deploy(
		"CommunityImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	// constructor's parameters are not important because this is a middle proxy contract
	// so, we can use any contract address and any address in order to create the contract
	const CommunityMiddleProxyResult = await deploy("CommunityMiddleProxy", {
		from: deployer.address,
		args: [ImpactProxyAdmin.address, deployer.address],
		log: true,
		// gasLimit: 13000000,
	});

	await CommunityAdminContract.initialize(
		communityImplementationResult.address,
		cUSDAddress
	);

	CommunityAdminContract.updateCommunityMiddleProxy(
		CommunityMiddleProxyResult.address
	);

	const Treasury = await deployments.get("TreasuryProxy");

	const TreasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		Treasury.address
	);

	await CommunityAdminContract.updateTreasury(Treasury.address);
	await CommunityAdminContract.updateMinClaimAmountRatio(10000);

	await CommunityAdminContract.updateTreasurySafetyPercentage(9);
	await CommunityAdminContract.updateTreasuryMinBalance(toEther(100));

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
