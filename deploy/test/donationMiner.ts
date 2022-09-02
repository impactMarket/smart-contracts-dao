import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { getCUSDAddress } from "./cUSD";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getChainId } from "hardhat";
import { getBlockNumber } from "../../test/utils/TimeTravel";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const Token = await deployments.get("PACTToken");
	const Treasury = await deployments.get("TreasuryProxy");

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	// const PACTTimelock = await deployments.get("PACTTimelock"); //prod
	// const ownerAddress = PACTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev
	const cUSDAddress = getCUSDAddress();

	const donationMinerImplementationResult = await deploy(
		"DonationMinerImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const donationMinerProxyResult = await deploy("DonationMinerProxy", {
		from: deployer.address,
		args: [
			donationMinerImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
		// gasLimit: 13000000,
	});

	const donationMinerContract = await ethers.getContractAt(
		"DonationMinerImplementation",
		donationMinerProxyResult.address
	);

	const blockNumber = await getBlockNumber();
	const startingBlock = blockNumber > 130 ? blockNumber : 130;

	//for testing we need that rewardPeriodSize to be a small number
	//to have the same reward for a period, will change the values for
	//firstRewardPerBlock (250) with  216000 (250 * 864)
	//and rewardPeriodSize (17280) with  20 (17280 / 864)
	await donationMinerContract.initialize(
		cUSDAddress,
		Token.address,
		Treasury.address,
		parseEther("216000"),
		20,
		startingBlock,
		"998902",
		"1000000"
	);

	const PACT = await deployments.get("PACTToken");
	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);

	await PACTContract.transfer(
		donationMinerContract.address,
		parseEther("4000000000")
	);

	await donationMinerContract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = [
	"ImpactProxyAdminTest",
	"GovernanceTest",
	"TreasuryTest",
	"cUSDTest",
];
func.tags = ["DonationMinerTest", "Test"];
