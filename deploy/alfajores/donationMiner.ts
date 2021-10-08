import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { getCUSDAddress } from "./cUSD";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const Token = await deployments.get("IPCTToken");
	const Treasury = await deployments.get("Treasury");

	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	// const ownerAddress = IPCTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev

	const DonationMinerResult = await deploy("DonationMiner", {
		from: deployer.address,
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

	await DonationMiner.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = [
	"ImpactProxyAdminAlfajores",
	"TreasuryAlfajores",
	"cUSDAlfajores",
	"TokenTest",
];
func.tags = ["DonationMinerAlfajores", "Alfajores"];
