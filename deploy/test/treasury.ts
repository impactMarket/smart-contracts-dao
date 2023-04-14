import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { getCUSDAddress } from "./cUSD";
import { toEther } from "../../test/utils/helpers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

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

	const PACT = await deployments.get("PACTToken");

	await treasuryContract.initialize(ZERO_ADDRESS);
	await treasuryContract.updatePACT(PACT.address);
	const cUSDAddress = getCUSDAddress();

	await treasuryContract.setToken(
		cUSDAddress,
		toEther(1),
		0,
		0,
		0,
		0,
		"0x",
		"0x"
	);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "cUSDTest"];
func.tags = ["TreasuryTest", "Test"];
