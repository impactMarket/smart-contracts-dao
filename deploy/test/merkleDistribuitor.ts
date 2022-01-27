import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// const PACTTimelock = await deployments.get("PACTTimelock"); //prod
	// const ownerAddress = PACTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev

	const PACT = await deployments.get("PACTToken");

	const mTree = require("../../airdrop_scripts/tree_scripts/merkleTree_test.json");

	const MerkleDistributor = await deploy("MerkleDistributor", {
		from: deployer.address,
		args: [PACT.address, mTree["merkleRoot"]],
		log: true,
		// gasLimit: 13000000,
	});

	const MerkleDistributorContract = await ethers.getContractAt(
		"MerkleDistributor",
		MerkleDistributor.address
	);

	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);

	await PACTContract.transfer(
		MerkleDistributor.address,
		parseEther("1000000000")
	);

	await MerkleDistributorContract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = ["TokenTest"];
func.tags = ["MerkleDistributorTest", "Test"];
