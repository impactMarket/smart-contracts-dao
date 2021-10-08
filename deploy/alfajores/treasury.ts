import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	await deploy("Treasury", {
		from: deployer.address,
		args: [ZERO_ADDRESS],
		log: true,
	});
};

export default func;
func.dependencies = ["ImpactProxyAdminAlfajores", "cUSDAlfajores"];
func.tags = ["TreasuryAlfajores", "Alfajores"];
