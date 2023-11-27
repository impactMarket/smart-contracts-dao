import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toEther } from "../../test/utils/helpers";
import { generateMerkleTree } from "../../script/merkleTree/generateMerkleTree";
import { getCUSDAddress } from "./cUSD";
import {uniswapQuoterAddress, uniswapRouterAddress} from "../../test/utils/uniswap";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];
	const owner = accounts[1];

	const ImpactMultiSigProxyAdminResult = await deploy(
		"ImpactMultiSigProxyAdmin",
		{
			from: deployer.address,
			args: [],
			log: true,
		}
	);

	const cUSDAddress = getCUSDAddress();

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

	const microcreditRevenueProxyResult = await deploy(
		"MicrocreditRevenueProxy",
		{
			from: deployer.address,
			args: [
				microcreditRevenueImplementationResult.address,
				ImpactMultiSigProxyAdminResult.address,
			],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const microcreditRevenueContract = await ethers.getContractAt(
		"MicrocreditRevenueImplementation",
		microcreditRevenueProxyResult.address
	);

	await microcreditRevenueContract.initialize();
	await microcreditRevenueContract.transferOwnership(owner.address);

	// deploy microcredit
	const microcreditImplementationResult = await deploy(
		"MicrocreditImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const microcreditProxyResult = await deploy("MicrocreditProxy", {
		from: deployer.address,
		args: [
			microcreditImplementationResult.address,
			ImpactMultiSigProxyAdminResult.address,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const microcreditContract = await ethers.getContractAt(
		"MicrocreditImplementation",
		microcreditProxyResult.address
	);
	await microcreditContract.initialize(
		cUSDAddress,
		microcreditRevenueContract.address
	);

	const donationMiner = await ethers.getContractAt(
		"DonationMinerImplementation",
		(
			await deployments.get("DonationMinerProxy")
		).address
	);

	await donationMiner.updateMicrocredit(microcreditContract.address);

	await microcreditContract.updateDonationMiner(donationMiner.address);
	await microcreditContract.updateUniswapRouter(uniswapRouterAddress);
	await microcreditContract.updateUniswapQuoter(uniswapQuoterAddress);

	await microcreditContract.transferOwnership(owner.address);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "cUSDTest", "DonationMinerTest"];
func.tags = ["MicrocreditTest"];
