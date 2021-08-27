import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const cUSD = await deployments.get("TokenMock");

	const Token = await deployments.get("IPCTToken");
	const Treasury = await deployments.get("Treasury");
	const IPCTTimelock = await deployments.get("IPCTTimelock");

	const DonationMinerResult = await deploy("DonationMiner", {
		from: deployer,
		args: [
			cUSD.address,
			Token.address,
			Treasury.address,
			parseEther("100"),
			14,
			30,
		],
		log: true,
	});

	const DonationMiner = await ethers.getContractAt(
		"DonationMiner",
		DonationMinerResult.address
	);

	await DonationMiner.transferOwnership(IPCTTimelock.address);
};

export default func;
func.dependencies = ["GovernanceTest", "TreasuryTest", "cUSDTest"];
func.tags = ["DonationMinerTest", "Test"];
