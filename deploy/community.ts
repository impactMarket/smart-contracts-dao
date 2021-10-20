import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { parseEther } from "@ethersproject/units";
import { getCUSDAddress } from "./cUSD";

const COMMUNITY_MIN_TRANCHE: BigNumberish = parseEther("100");
const COMMUNITY_MAX_TRANCHE: BigNumberish = parseEther("5000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const communityAdminImplementationResult = await deploy("CommunityAdminImplementation", {
		from: deployer,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	const communityAdminProxyResult = await deploy("CommunityAdminProxy", {
		from: deployer,
		args: [communityAdminImplementationResult.address],
		log: true,
		// gasLimit: 13000000,
	});

	const communityAdminHelperResult = await deploy("CommunityAdminHelper", {
		from: deployer,
		args: [communityAdminProxyResult.address],
		log: true,
		// gasLimit: 13000000,
	});

	const Treasury = await deployments.get("Treasury");
	const IPCTTimelock = await deployments.get("IPCTTimelock");

	const TreasuryContract = await ethers.getContractAt(
		"Treasury",
		Treasury.address
	);
	const CommunityAdminProxyContract = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdminProxyResult.address
	);

	await CommunityAdminProxyContract.initialize(getCUSDAddress(), COMMUNITY_MIN_TRANCHE, COMMUNITY_MAX_TRANCHE);
	await CommunityAdminProxyContract.setTreasury(Treasury.address);
	await CommunityAdminProxyContract.setCommunityAdminHelper(
		communityAdminHelperResult.address
	);

	await CommunityAdminProxyContract.transferOwnership(IPCTTimelock.address); //just in prod
	await TreasuryContract.setCommunityAdmin(communityAdminProxyResult.address);
	await TreasuryContract.transferOwnership(IPCTTimelock.address); // just in prod
};

func.dependencies = ["Governance", "Treasury", "cUSD"];
func.tags = ["Community", "Prod"];
export default func;
