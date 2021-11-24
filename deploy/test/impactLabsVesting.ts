// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { parseEther } from "@ethersproject/units";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
//
// const IMPACT_LABS_AMOUNT = parseEther("3000000000");
// const IMPACT_LABS_ADVANCE_PAYMENT = parseEther("100000000");
//
// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
// 	// @ts-ignore
// 	const { deployments, getNamedAccounts, ethers } = hre;
// 	const { deploy } = deployments;
//
// 	const accounts: SignerWithAddress[] = await ethers.getSigners();
// 	const deployer = accounts[0];
//
// 	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
//
// 	// const IPCTTimelock = await deployments.get("IPCTTimelock"); //prod
// 	// const ownerAddress = IPCTTimelock.address; //prod
// 	const ownerAddress = deployer.address; //dev
//
// 	const donationMiner = await deployments.get("DonationMinerProxy");
//
// 	const IPCT = await deployments.get("IPCTToken");
// 	const IPCTContract = await ethers.getContractAt("IPCTToken", IPCT.address);
//
// 	const impactLabsVestingImplementationResult = await deploy(
// 		"ImpactLabsVestingImplementation",
// 		{
// 			from: deployer.address,
// 			args: [],
// 			log: true,
// 			// gasLimit: 13000000,
// 		}
// 	);
//
// 	const impactLabsVestingProxyResult = await deploy(
// 		"ImpactLabsVestingProxy",
// 		{
// 			from: deployer.address,
// 			args: [
// 				impactLabsVestingImplementationResult.address,
// 				ImpactProxyAdmin.address,
// 			],
// 			log: true,
// 			// gasLimit: 13000000,
// 		}
// 	);
//
// 	const impactLabsVestingContract = await ethers.getContractAt(
// 		"ImpactLabsVestingImplementation",
// 		impactLabsVestingProxyResult.address
// 	);
//
// 	IPCTContract.transfer(
// 		impactLabsVestingProxyResult.address,
// 		IMPACT_LABS_AMOUNT
// 	);
//
// 	await impactLabsVestingContract.initialize(
// 		ownerAddress,
// 		IPCT.address,
// 		donationMiner.address,
// 		IMPACT_LABS_ADVANCE_PAYMENT
// 	);
//
// 	await impactLabsVestingContract.transferOwnership(ownerAddress);
// };
//
// export default func;
// func.dependencies = ["DonationMinerTest"];
// func.tags = ["ImpactLabsVestingTest", "Test"];
