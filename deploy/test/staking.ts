import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const IMPACT_LABS_AMOUNT = parseEther("3000000000");
const IMPACT_LABS_ADVANCE_PAYMENT = parseEther("100000001");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	// const PACTTimelock = await deployments.get("PACTTimelock"); //prod
	// const ownerAddress = PACTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev

	const donationMiner = await ethers.getContractAt(
		"DonationMinerImplementation",
		(
			await deployments.get("DonationMinerProxy")
		).address
	);

	const PACT = await ethers.getContractAt(
		"PACTToken",
		(
			await deployments.get("PACTToken")
		).address
	);

	const SPACT = await ethers.getContractAt(
		"SPACTToken",
		(
			await deployments.get("SPACTToken")
		).address
	);

	const stakingImplementationResult = await deploy("StakingImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	const stakingProxyResult = await deploy("StakingProxy", {
		from: deployer.address,
		args: [stakingImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const stakingContract = await ethers.getContractAt(
		"StakingImplementation",
		stakingProxyResult.address
	);

	await stakingContract.initialize(
		PACT.address,
		SPACT.address,
		donationMiner.address,
		100
	);

	await stakingContract.transferOwnership(ownerAddress);
	// await SPACT.transferOwnership(stakingContract.address);
	await donationMiner.updateStaking(stakingContract.address);
};

export default func;
func.dependencies = ["DonationMinerTest", "StakingPactTest"];
func.tags = ["StakingTest", "Test"];
