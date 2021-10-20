import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	// const ownerAddress = IPCTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	const treasuryImplementationResult = await deploy(
		"TreasuryImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const treasuryProxyResult = await deploy("TreasuryProxy", {
		from: deployer.address,
		args: [treasuryImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const treasuryContract = await ethers.getContractAt(
		"TreasuryImplementation",
		treasuryProxyResult.address
	);

	await treasuryContract.initialize(ZERO_ADDRESS);

	await treasuryContract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "cUSDTest"];
func.tags = ["TreasuryTest", "Test"];
