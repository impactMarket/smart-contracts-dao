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

	const communityAdminResult = await deploy("CommunityAdminMock", {
		from: deployer,
		args: [getCUSDAddress(), COMMUNITY_MIN_TRANCHE, COMMUNITY_MAX_TRANCHE],
		log: true,
		// gasLimit: 13000000,
	});

	const communityAdminHelperResult = await deploy("CommunityAdminHelper", {
		from: deployer,
		args: [communityAdminResult.address],
		log: true,
		// gasLimit: 13000000,
	});

	const Treasury = await deployments.get("TreasuryMock");
	const IPCTTimelock = await deployments.get("IPCTTimelock");

	const TreasuryContract = await ethers.getContractAt(
		"Treasury",
		Treasury.address
	);
	const CommunityAdminContract = await ethers.getContractAt(
		"CommunityAdminMock",
		communityAdminResult.address
	);

	await CommunityAdminContract.setTreasury(Treasury.address);
	await CommunityAdminContract.setCommunityAdminHelper(
		communityAdminHelperResult.address
	);

	await CommunityAdminContract.transferOwnership(IPCTTimelock.address);
	await TreasuryContract.setCommunityAdmin(communityAdminResult.address);
	await TreasuryContract.transferOwnership(IPCTTimelock.address);
};

func.dependencies = ["GovernanceTest", "TreasuryTest", "cUSDTest"];
func.tags = ["CommunityTest", "Test"];
export default func;
