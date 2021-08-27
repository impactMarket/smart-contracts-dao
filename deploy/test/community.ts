import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { parseEther } from "@ethersproject/units";
// const {ethers} = require('hardhat');

const COMMUNITY_MIN_TRANCHE: BigNumberish = parseEther("100");
const COMMUNITY_MAX_TRANCHE: BigNumberish = parseEther("5000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const cUSD = await deployments.get("TokenMock");

	const communityAdminResult = await deploy("CommunityAdminMock", {
		from: deployer,
		args: [cUSD.address, COMMUNITY_MIN_TRANCHE, COMMUNITY_MAX_TRANCHE],
		log: true,
		// gasLimit: 13000000,
	});

	const communityFactoryResult = await deploy("CommunityFactory", {
		from: deployer,
		args: [cUSD.address, communityAdminResult.address],
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
		"CommunityAdminMock",
		communityAdminResult.address
	);

	console.log(await IPCTTimelock.address);
	console.log(await CommunityAdminContract.owner());

	await CommunityAdminContract.setTreasury(Treasury.address);
	await CommunityAdminContract.setCommunityFactory(
		communityFactoryResult.address
	);

	await CommunityAdminContract.transferOwnership(IPCTTimelock.address);

	await TreasuryContract.setCommunityAdmin(communityAdminResult.address);
	await TreasuryContract.setAdmin(IPCTTimelock.address);
};

func.dependencies = ["GovernanceTest", "TreasuryTest", "cUSDTest"];
func.tags = ["CommunityTest", "Test"];
export default func;
