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

	console.log(1);
	const communityAdminImplementationResult = await deploy(
		"CommunityAdminImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	console.log(2);
	const communityResult = await deploy("Community", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	console.log(3);
	const communityAdminProxyResult = await deploy("CommunityAdminProxy", {
		from: deployer.address,
		args: [
			communityAdminImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
		// gasLimit: 13000000,
	});

	console.log(4);
	const CommunityAdminProxyContract = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdminProxyResult.address
	);

	console.log(5);
	await CommunityAdminProxyContract.initialize(
		communityResult.address,
		getCUSDAddress(),
		COMMUNITY_MIN_TRANCHE,
		COMMUNITY_MAX_TRANCHE
	);

	await CommunityAdminProxyContract.transferOwnership(ownerAddress);

	console.log(6);
	const Treasury = await deployments.get("Treasury");

	console.log(7);
	const TreasuryContract = await ethers.getContractAt(
		"Treasury",
		Treasury.address
	);

	console.log(8);
	await CommunityAdminProxyContract.setTreasury(Treasury.address);

	console.log(9);
	await TreasuryContract.setCommunityAdmin(communityAdminProxyResult.address);

	console.log(10);
	await TreasuryContract.transferOwnership(ownerAddress);
	console.log(11);
};

func.dependencies = [
	"ImpactProxyAdminTest",
	"GovernanceTest",
	"TreasuryTest",
	"cUSDTest",
];
func.tags = ["CommunityTest", "Test"];
export default func;
