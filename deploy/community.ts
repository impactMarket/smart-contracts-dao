import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { parseEther } from "@ethersproject/units";
// const {ethers} = require('hardhat');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const COMMUNITY_MIN_TRANCHE: BigNumberish = parseEther("100");
const COMMUNITY_MAX_TRANCHE: BigNumberish = parseEther("5000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, getChainId, ethers } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const chainID = await getChainId();

	let cUSDToken =
		chainID === "44787"
			? "0x874069fa1eb16d44d622f2e0ca25eea172369bc1"
			: chainID === "62320"
			? "0x62492a644a588fd904270bed06ad52b9abfea1ae"
			: chainID === "42220"
			? "0x765de816845861e75a25fca122bb6898b8b1282a"
			: ZERO_ADDRESS;

	if (cUSDToken === ZERO_ADDRESS) {
		// If no real network specified, create our own cUSD Token
		const cUSDResult = await deploy("TokenMock", {
			from: deployer,
			args: ["cUSD", "cUSD"],
			log: true,
			// gasLimit: 13000000,
		});
		cUSDToken = cUSDResult.address;
	}

	const communityAdminResult = await deploy("CommunityAdmin", {
		from: deployer,
		args: [
			cUSDToken,
			deployer,
			COMMUNITY_MIN_TRANCHE,
			COMMUNITY_MAX_TRANCHE,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const communityFactoryResult = await deploy("CommunityFactory", {
		from: deployer,
		args: [cUSDToken, communityAdminResult.address],
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
	await CommunityAdminContract.setAdmin(IPCTTimelock.address);
	await TreasuryContract.setCommunityAdmin(communityAdminResult.address);
	await TreasuryContract.setAdmin(IPCTTimelock.address);
};

func.dependencies = ["Governance", "Treasury"];
func.tags = ["Community"];
export default func;
