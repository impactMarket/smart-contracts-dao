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

	const pactTimelock = await deployments.get("PACTTimelock"); //prod
	const ownerAddress = pactTimelock.address; //prod
	// const ownerAddress = deployer.address; //dev
	const impactLabsAddress = deployer.address; //must set a multisig wallet address

	const donationMiner = await deployments.get("DonationMinerProxy");

	const PACT = await deployments.get("PACTToken");
	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);

	const impactLabsVestingImplementationResult = await deploy(
		"ImpactLabsVestingImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const impactLabsVestingProxyResult = await deploy(
		"ImpactLabsVestingProxy",
		{
			from: deployer.address,
			args: [
				impactLabsVestingImplementationResult.address,
				ImpactProxyAdmin.address,
			],
			log: true,
			// gasLimit: 13000000,
		}
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	const impactLabsVestingContract = await ethers.getContractAt(
		"ImpactLabsVestingImplementation",
		impactLabsVestingProxyResult.address
	);

	await PACTContract.transfer(
		impactLabsVestingProxyResult.address,
		IMPACT_LABS_AMOUNT
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	await impactLabsVestingContract.initialize(
		impactLabsAddress,
		PACT.address,
		donationMiner.address,
		IMPACT_LABS_ADVANCE_PAYMENT
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	await impactLabsVestingContract.transferOwnership(ownerAddress);

	await new Promise((resolve) => setTimeout(resolve, 6000));
};

export default func;
func.dependencies = ["DonationMinerProd"];
func.tags = ["ImpactLabsVestingProd", "Prod"];
