import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import BalanceTree from '../../airdrop_scripts/balance-tree'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
	// const ownerAddress = IPCTTimelock.address; //prod
	const ownerAddress = deployer.address; //dev

	const PACT = await deployments.get("PACTToken");


	let tree: BalanceTree;
	tree = new BalanceTree([
		{ account: deployer.address, amount: parseEther("100") }
	])

	const MerkleDistributor = await deploy(
		"MerkleDistributor",
		{
			from: deployer.address,
			args: [PACT.address, tree.getHexRoot()],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const MerkleDistributorContract = await ethers.getContractAt("MerkleDistributor", MerkleDistributor.address);

	const PACTContract = await ethers.getContractAt("PACTToken", PACT.address);

	await PACTContract.transfer(
		MerkleDistributor.address,
		parseEther("100000000")
	);

	await MerkleDistributorContract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = [
	"TokenTest",
];
func.tags = ["MerkleDistributorTest", "Test"];
