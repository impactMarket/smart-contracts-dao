import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	const ownerAddress = IPCTTimelock.address; //prod
	// const ownerAddress = deployer.address; //dev

	// await new Promise((resolve) => setTimeout(resolve, 2000));

	const ImpactProxyAdminResult = await deploy("ImpactProxyAdmin", {
		from: deployer.address,
		args: [],
		log: true,
	});

	const ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		ImpactProxyAdminResult.address
	);

	await ImpactProxyAdmin.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = ["GovernanceProd"];
func.tags = ["ImpactProxyAdminProd", "Prod"];
