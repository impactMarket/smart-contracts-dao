import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {parseEther} from "@ethersproject/units";
import {getCUSDAddress}  from "./cUSD";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, getChainId, ethers } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const Token = await deployments.get("IPCTToken");
	const Treasury = await deployments.get("Treasury");
	const IPCTTimelock = await deployments.get("IPCTTimelock");

	const DonationMinerResult = await deploy("DonationMiner", {
		from: deployer,
		args: [
			getCUSDAddress(),
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
func.dependencies = ["Governance", "Treasury", "cUSD"];
func.tags = ["DonationMiner", "Prod"];
