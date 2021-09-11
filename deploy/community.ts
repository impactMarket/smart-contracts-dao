import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { parseEther } from "@ethersproject/units";
import {getCUSDAddress}  from "./cUSD";

const COMMUNITY_MIN_TRANCHE: BigNumberish = parseEther("100");
const COMMUNITY_MAX_TRANCHE: BigNumberish = parseEther("5000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, getChainId, ethers } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const communityAdminResult = await deploy("CommunityAdmin", {
		from: deployer,
		args: [getCUSDAddress(), COMMUNITY_MIN_TRANCHE, COMMUNITY_MAX_TRANCHE],
		log: true,
		// gasLimit: 13000000,
	});

	const communityFactoryResult = await deploy("CommunityFactory", {
		from: deployer,
		args: [communityAdminResult.address],
		log: true,
		// gasLimit: 13000000,
	});

	const Treasury = await deployments.get("Treasury");
	const IPCTTimelock = await deployments.get("IPCTTimelock");

	const TreasuryContract = await ethers.getContractAt(
		"Treasury",
		Treasury.address
	);
	const CommunityAdminContract = await ethers.getContractAt(
		"CommunityAdmin",
		communityAdminResult.address
	);

	await CommunityAdminContract.setTreasury(Treasury.address);
	await CommunityAdminContract.setCommunityFactory(
		communityFactoryResult.address
	);

	await CommunityAdminContract.transferOwnership(IPCTTimelock.address);
	await TreasuryContract.setCommunityAdmin(communityAdminResult.address);
	await TreasuryContract.transferOwnership(IPCTTimelock.address);
};

func.dependencies = ["Governance", "Treasury", "cUSD"];
func.tags = ["Community", "Prod"];
export default func;
