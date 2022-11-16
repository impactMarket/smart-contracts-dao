import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const signerWalletAddress = accounts[1].address;

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	const CommunityAdmin = await deployments.get("CommunityAdminProxy");

	const LearnAndEarnImplementationResult = await deploy(
		"LearnAndEarnImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const LearnAndEarnProxyResult = await deploy("LearnAndEarnProxy", {
		from: deployer.address,
		args: [
			LearnAndEarnImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
	});

	const LearnAndEarnContract = await ethers.getContractAt(
		"LearnAndEarnImplementation",
		LearnAndEarnProxyResult.address
	);

	await LearnAndEarnContract.initialize(
		signerWalletAddress,
		CommunityAdmin.address
	);
};

export default func;
func.dependencies = ["CommunityTest"];
func.tags = ["LearnAndEarnTest", "Test"];
