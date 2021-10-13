import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { parseEther } from "@ethersproject/units";
import { getCUSDAddress } from "./cUSD";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

const COMMUNITY_MIN_TRANCHE: BigNumberish = parseEther("100");
const COMMUNITY_MAX_TRANCHE: BigNumberish = parseEther("5000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;

	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	// const ownerAddress = IPCTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev
	// const cUSDAddress = getCUSDAddress(); //prod
	const cUSDAddress = (await deployments.get("TokenMock")).address; //dev

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
		cUSDAddress,
		COMMUNITY_MIN_TRANCHE,
		COMMUNITY_MAX_TRANCHE
	);

	await CommunityAdminContract.transferOwnership(ownerAddress);

	const Treasury = await deployments.get("TreasuryProxy");

	const TreasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		Treasury.address
	);

	await CommunityAdminContract.setTreasury(Treasury.address);

	await TreasuryContract.setCommunityAdmin(communityAdminProxyResult.address);

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
