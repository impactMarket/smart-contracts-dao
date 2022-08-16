import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const LENDING_POOL_ADDRESS = "0x970b12522CA9b4054807a2c5B736149a5BE6f670";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// const ownerAddress = (await deployments.get("PACTTimelock")).address; //prod
	const ownerAddress = deployer.address; //dev

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	const Treasury = await deployments.get("TreasuryProxy");
	const DonationMiner = await deployments.get("DonationMinerProxy");

	const depositImplementationResult = await deploy("DepositImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	const depositProxyResult = await deploy("DepositProxy", {
		from: deployer.address,
		args: [depositImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const depositContract = await ethers.getContractAt(
		"DepositImplementation",
		depositProxyResult.address
	);

	await depositContract.initialize(
		Treasury.address,
		DonationMiner.address,
		LENDING_POOL_ADDRESS,
		[]
	);

	await depositContract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = [
	"ImpactProxyAdminTest",
	"TreasuryTest",
	"DonationMinerTest",
];
func.tags = ["DonationTest", "Test"];
